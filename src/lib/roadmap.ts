/**
 * =============================================================================
 * Núcleo de dominio de RoadGate
 * =============================================================================
 * Funciones puras (sin React ni backend) que definen el modelo y las reglas de
 * cálculo del roadmap. Todo lo que se muestra en pantalla o se exporta a Excel
 * se deriva de aquí, de modo que UI, persistencia e informes nunca discrepen.
 *
 * Conceptos clave:
 *  - Jerarquía: Epic → Feature → User Story (vía `parentId` sobre el campo `id`).
 *  - La HOJA es la fuente de verdad: solo las hojas aportan esfuerzo; el padre
 *    es un agregado visual (Σ de sus hojas) → nunca hay doble conteo.
 *  - El Quarter del padre es DERIVADO de sus hijos: un Q concreto si todos
 *    coinciden, "MULTI" si están repartidos, "" si ninguno está planificado.
 *  - `normalizeItems` aplica ambos invariantes y debe ejecutarse antes de
 *    persistir cualquier cambio.
 */

export type ItemType = "epic" | "feature" | "story";
/**
 * "MULTI" es un estado exclusivo de items agrupadores (Epic/Feature): significa
 * que sus hijos están repartidos en varios Quarters (o solo parcialmente planificados).
 * Nunca se asigna a hojas y no se renderiza como columna del roadmap.
 */
export type RealQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export type Quarter = RealQuarter | "MULTI" | "";
export type Priority = "1-High" | "2-Medium" | "3-Low" | "4-Lowest" | "";
export type State = "Backlog" | "In Progress" | "Done" | "Blocked";
export type DisplayMode = "auto" | "self" | "children";

export type RoadmapItem = {
  id: string;
  uid: string;
  type: ItemType;
  title: string;
  description?: string;
  parentId?: string;
  effort?: number;
  priority?: Priority;
  quarter?: Quarter;
  sprint?: number;       // 1..N within the assigned quarter
  state?: State;
  notes?: string;
  tags?: string;
  displayMode?: DisplayMode;
  hiddenFromRoadmap?: boolean;
};

export type CapacityConfig = {
  developers: number;
  dedicationPct: number;
  daysPerSprint: number;
  hoursPerDay: number;
  sprintsPerQuarter: number;             // default for every quarter
  sprintsByQuarter?: Partial<Record<RealQuarter, number>>; // per-Q override
};

export const defaultCapacity: CapacityConfig = {
  developers: 7,
  dedicationPct: 30,
  daysPerSprint: 10,
  hoursPerDay: 5,
  sprintsPerQuarter: 5,
  sprintsByQuarter: {},
};

/**
 * Índice `parentId -> hijos directos`, ignorando padres inexistentes y
 * auto-referencias (`parentId === id`), que provocaban recursión infinita.
 */
function buildChildrenMap(
  list: RoadmapItem[],
  byId: Map<string, RoadmapItem>,
): Map<string, RoadmapItem[]> {
  const map = new Map<string, RoadmapItem[]>();
  list.forEach((i) => {
    if (!i.parentId || i.parentId === i.id || !byId.has(i.parentId)) return;
    const arr = map.get(i.parentId) ?? [];
    arr.push(i);
    map.set(i.parentId, arr);
  });
  return map;
}

/** Items sin padre válido: raíces del árbol para los recorridos top-down. */
function rootsOf(list: RoadmapItem[], byId: Map<string, RoadmapItem>): RoadmapItem[] {
  return list.filter((i) => !i.parentId || i.parentId === i.id || !byId.has(i.parentId));
}

/**
 * Deriva el Quarter de los items agrupadores (los que tienen hijos) a partir de
 * sus descendientes, de abajo hacia arriba:
 *  - todos los hijos en el mismo Q  → el padre queda en ese Q
 *  - hijos en Q distintos, o solo algunos planificados → "MULTI"
 *  - ningún hijo planificado → "" (sin quarter)
 * Las hojas conservan siempre su propio quarter.
 */
export function syncParentQuarters(input: RoadmapItem[]): RoadmapItem[] {
  // --- Fase 0 (top-down): materializar la herencia de Quarter -------------
  // Un padre planificado en un Q concreto cuya rama entera está SIN planificar
  // baja ese Q a todos sus descendientes (caso típico de importación o de un
  // padre recién arrastrado). Si algún descendiente ya tiene Q propio, NO se
  // hereda nada: así devolver un hijo suelto al Backlog es una acción estable
  // y el padre pasa a MULTI en la fase 1 en vez de "recapturar" al hijo.
  const items = (() => {
    const byIdIn = new Map(input.map((i) => [i.id, i]));
    const kidsIn = buildChildrenMap(input, byIdIn);
    const patched = new Map<string, Quarter>();

    const subtreeUnassigned = (node: RoadmapItem, seen: Set<string>): boolean => {
      if (seen.has(node.uid)) return true;
      seen.add(node.uid);
      const kids = kidsIn.get(node.id) ?? [];
      if (kids.length === 0) return (node.quarter ?? "") === "";
      if ((node.quarter ?? "") !== "" && (node.quarter ?? "") !== "MULTI") return false;
      return kids.every((k) => subtreeUnassigned(k, seen));
    };
    const markAll = (node: RoadmapItem, q: Quarter, seen: Set<string>) => {
      (kidsIn.get(node.id) ?? []).forEach((k) => {
        if (seen.has(k.uid)) return;
        seen.add(k.uid);
        patched.set(k.uid, q);
        markAll(k, q, seen);
      });
    };
    const walkDown = (node: RoadmapItem, seen: Set<string>) => {
      if (seen.has(node.uid)) return;
      seen.add(node.uid);
      const kids = kidsIn.get(node.id) ?? [];
      if (kids.length === 0) return;
      const own = (node.quarter ?? "") as Quarter;
      if (own !== "" && own !== "MULTI" && kids.every((k) => subtreeUnassigned(k, new Set()))) {
        markAll(node, own, seen);
        return;
      }
      kids.forEach((k) => walkDown(k, seen));
    };
    rootsOf(input, byIdIn).forEach((r) => walkDown(r, new Set()));
    return patched.size
      ? input.map((i) => (patched.has(i.uid) ? { ...i, quarter: patched.get(i.uid)! } : i))
      : input;
  })();

  const byId = new Map(items.map((i) => [i.id, i]));
  const childrenMap = buildChildrenMap(items, byId);


  const memo = new Map<string, Quarter>();
  const resolve = (item: RoadmapItem, seen = new Set<string>()): Quarter => {
    if (memo.has(item.uid)) return memo.get(item.uid)!;
    if (seen.has(item.uid)) return item.quarter ?? "";
    seen.add(item.uid);
    const kids = childrenMap.get(item.id) ?? [];
    if (kids.length === 0) {
      const own = (item.quarter ?? "") as Quarter;
      const leafQ = own === "MULTI" ? "" : own; // una hoja nunca puede ser MULTI
      memo.set(item.uid, leafQ);
      return leafQ;
    }
    const kidQs = kids.map((k) => resolve(k, seen));
    const distinct = new Set(kidQs);
    let q: Quarter;
    if (distinct.size === 1 && !distinct.has("MULTI")) q = [...distinct][0];
    else if (kidQs.every((k) => k === "")) q = "";
    else q = "MULTI";
    memo.set(item.uid, q);
    return q;
  };

  return items.map((it) => {
    const kids = childrenMap.get(it.id) ?? [];
    if (kids.length === 0) {
      return (it.quarter ?? "") === "MULTI" ? { ...it, quarter: "" as Quarter } : it;
    }
    const q = resolve(it);
    return (it.quarter ?? "") === q ? it : { ...it, quarter: q };
  });
}

/**
 * Invariante de prioridad (Reglas 3 y 4):
 *  - En el Roadmap (Q1–Q4 o MULTI) solo se admite Alta o Media. Un item con
 *    Baja/Mínima/sin prioridad hereda la prioridad del ancestro más cercano
 *    que sea Alta o Media; si no hay ninguno, se marca como Alta.
 *  - Ningún item del Backlog puede ser Alta; si lo era, baja a "3-Low".
 *    Los items sin prioridad ("") en Backlog se respetan tal cual.
 */
export function enforcePriorityInvariant(items: RoadmapItem[]): RoadmapItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const isRoadmapPriority = (p: Priority) => p === "1-High" || p === "2-Medium";
  const inheritedPriority = (it: RoadmapItem): Priority => {
    const seen = new Set<string>();
    let cur = it.parentId ? byId.get(it.parentId) : undefined;
    while (cur && !seen.has(cur.uid)) {
      seen.add(cur.uid);
      const p = (cur.priority ?? "") as Priority;
      if (isRoadmapPriority(p)) return p;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return "1-High";
  };
  return items.map((it) => {
    const q = (it.quarter ?? "") as Quarter;
    const p = (it.priority ?? "") as Priority;
    if (q !== "") {
      if (isRoadmapPriority(p)) return it;
      return { ...it, priority: inheritedPriority(it) };
    }
    if (p === "1-High") return { ...it, priority: "3-Low" as Priority };
    return it;
  });
}


/**
 * Enforce the invariant: parent.effort = Σ(children rolled-up effort)
 * y parent.quarter = derivado de sus hijos (ver syncParentQuarters).
 * Callers should run this before persisting so stored data stays consistent.
 */
export function normalizeItems(items: RoadmapItem[]): RoadmapItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const childrenMap = buildChildrenMap(items, byId);
  // `seen` evita el desbordamiento de pila si los datos importados traen un
  // ciclo de parentId (A→B→A) o una auto-referencia.
  const rollup = (item: RoadmapItem, seen: Set<string>): number => {
    if (seen.has(item.uid)) return 0;
    seen.add(item.uid);
    const kids = childrenMap.get(item.id) ?? [];
    if (kids.length === 0) return item.effort || 0;
    return kids.reduce((s, k) => s + rollup(k, seen), 0);
  };
  const withEffort = items.map((it) => {
    const kids = childrenMap.get(it.id) ?? [];
    if (kids.length === 0) return it;
    const sum = rollup(it, new Set());
    return it.effort === sum ? it : { ...it, effort: sum };
  });
  return enforcePriorityInvariant(syncParentQuarters(withEffort));
}



export function sprintsForQuarter(c: CapacityConfig, q: RealQuarter) {
  const v = c.sprintsByQuarter?.[q];
  return typeof v === "number" && v >= 0 ? v : c.sprintsPerQuarter;
}
export function capacityPerSprint(c: CapacityConfig) {
  return c.developers * (c.dedicationPct / 100) * c.daysPerSprint * c.hoursPerDay;
}
export function capacityPerQuarter(c: CapacityConfig, q?: RealQuarter) {
  const sprints = q ? sprintsForQuarter(c, q) : c.sprintsPerQuarter;
  return capacityPerSprint(c) * sprints;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Minimal CSV parser supporting quoted fields and commas inside quotes
/** Parser CSV mínimo con soporte de comillas, comas y saltos de línea dentro del campo. */
export function parseCSV(text: string): Record<string, string>[] {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); rows.push(cur); cur = []; field = "";
      } else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const filtered = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!filtered.length) return [];
  // Excel con TODO el CSV pegado dentro de una sola columna: al convertirlo
  // a CSV cada fila queda como un único campo entrecomillado. Lo reprocesamos.
  if (filtered.every((r) => r.length === 1) && filtered[0][0].includes(",")) {
    return parseCSV(filtered.map((r) => r[0]).join("\n"));
  }
  const headers = filtered[0].map((h) => h.trim());
  // Tolerancia a exportaciones de Azure DevOps donde la columna
  // "Work Item Type" viene vacía y directamente OMITIDA en las filas:
  // la fila tiene una columna menos que la cabecera y todo se desplaza
  // (el título caía en "Work Item Type", el esfuerzo en "Parent", etc.).
  const witIdx = headers.findIndex((h) => /^work item type$|^item type$|^type$/i.test(h.trim()));
  return filtered.slice(1).map((row) => {
    let r = row;
    if (witIdx >= 0 && r.length === headers.length - 1) {
      r = [...r.slice(0, witIdx), "", ...r.slice(witIdx)];
    }
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
    return o;
  });
}

/** Lee de una fila CSV la primera columna cuyo nombre coincida (sin distinguir mayúsculas). */
function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const lk = k.toLowerCase().trim();
    if (keys.some((kk) => lk === kk.toLowerCase())) return row[k];
  }
  return "";
}

/** Deduce el tipo de work item a partir del texto de "Work Item Type". */
function detectType(raw: string, fallback: ItemType): ItemType {
  const v = raw.toLowerCase().trim();
  if (!v) return fallback;
  if (v.startsWith("epic")) return "epic";
  if (v.startsWith("feature")) return "feature";
  if (v.startsWith("user story") || v.startsWith("story") || v.startsWith("product backlog") || v === "pbi" || v === "task") return "story";
  return fallback;
}

/** Traduce prioridades en texto libre (español/inglés, numeradas) al enum interno. */
function normalizePriority(raw: string): Priority {
  const v = raw.trim();
  if (!v) return "";
  if (/^1/.test(v) || /high/i.test(v) || /alta/i.test(v)) return "1-High";
  if (/^2/.test(v) || /med/i.test(v)) return "2-Medium";
  if (/^3|4/.test(v) || /low/i.test(v) || /baja/i.test(v)) return "3-Low";
  return (v as Priority) || "";
}

/** Extrae Q1..Q4 de un texto libre (p. ej. una Iteration Path). */
function normalizeQuarter(raw: string): Quarter {
  const m = raw.match(/Q[1-4]/i);
  return (m ? (m[0].toUpperCase() as Quarter) : "");
}

/** Excel suele exportar los IDs numéricos como "622.0"; los normalizamos. */
function normalizeId(raw: string): string {
  const v = raw.trim();
  return /^\d+\.0+$/.test(v) ? v.replace(/\.0+$/, "") : v;
}

/**
 * Imports CSV. Supports Azure DevOps export headers:
 *  ID, Work Item Type, Title, Parent, State, Effort/Story Points, Priority,
 *  Iteration Path, Tags, Description.
 * También la estructura de Features:
 *  ID, Title, EPIC ID, EPIC Title, Effort (h), Priority, Quarter, State, Owner, PBIs #, Comments
 * If "Work Item Type" is missing, falls back to `defaultType` for every row.
 */
export function importCSV(text: string, defaultType: ItemType, existing: RoadmapItem[]): RoadmapItem[] {
  const rows = parseCSV(text);
  const newItems: RoadmapItem[] = rows.map((r) => {
    const wit = pick(r, ["work item type", "type", "item type"]);
    const type = detectType(wit, defaultType);
    const id = normalizeId(pick(r, ["id", "key", "work item id"])) || `${type.toUpperCase()}-${uid().slice(0, 4)}`;
    const iter = pick(r, ["iteration path", "iteration", "sprint"]);
    return {
      uid: uid(),
      id,
      type,
      title: pick(r, ["title", "name", "summary"]),
      description: pick(r, ["description", "desc"]),
      parentId: normalizeId(pick(r, ["parent", "parentid", "parent id", "parent work item", "epic id", "epic"])) || undefined,
      effort: Number(pick(r, ["effort", "effort (h)", "hours", "estimate", "story points", "original estimate"])) || undefined,
      priority: normalizePriority(pick(r, ["priority"])),
      quarter: normalizeQuarter(pick(r, ["quarter", "q"]) || iter),
      state: (pick(r, ["state", "status"]) as State) || "Backlog",
      notes: pick(r, ["notes", "comment", "comments"]),
      tags: pick(r, ["tags", "labels", "owner"]),
    };
  });
  // dedupe by id keeping new
  const map = new Map<string, RoadmapItem>();
  [...existing, ...newItems].forEach((it) => map.set(`${it.type}:${it.id}`, it));
  return [...map.values()];
}

/**
 * Serializa los items a CSV. Para Features usa exactamente la estructura del
 * fichero de negocio (ID, Title, EPIC ID, EPIC Title, Effort (h), Priority,
 * Quarter, State, Owner, PBIs #, Comments); el resto usa cabeceras Azure DevOps.
 */
export function toCSV(items: RoadmapItem[], type?: ItemType, all: RoadmapItem[] = items): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  if (type === "feature") {
    const headers = ["ID", "Title", "EPIC ID", "EPIC Title", "Effort (h)", "Priority", "Quarter", "State", "Owner", "PBIs #", "Comments"];
    const lines = [headers.join(",")];
    items.forEach((it) => {
      const epicTitle = all.find((p) => p.id === it.parentId)?.title ?? "";
      const pbis = all.filter((c) => c.parentId === it.id).length;
      lines.push([
        it.id, it.title, it.parentId ?? "", epicTitle,
        it.effort ?? "", it.priority ?? "", it.quarter ?? "", it.state ?? "",
        it.tags ?? "", pbis, it.notes ?? "",
      ].map(esc).join(","));
    });
    return lines.join("\n");
  }

  if (type === "story") {
    const headers = ["ID", "Title", "Parent Type", "Parent ID", "Parent Title", "Effort (h)", "Priority", "Quarter", "Comments"];
    const witLabel: Record<ItemType, string> = { epic: "Epic", feature: "Feature", story: "User Story" };
    const lines = [headers.join(",")];
    items.forEach((it) => {
      const parent = all.find((p) => p.id === it.parentId);
      lines.push([
        it.id, it.title, parent ? witLabel[parent.type] : "", it.parentId ?? "", parent?.title ?? "",
        it.effort ?? "", it.priority ?? "", it.quarter ?? "", it.notes ?? "",
      ].map(esc).join(","));
    });
    return lines.join("\n");
  }


  const headers = ["ID", "Work Item Type", "Title", "Description", "Parent", "Effort", "Priority", "Quarter", "State", "Tags", "Notes"];
  const witLabel: Record<ItemType, string> = { epic: "Epic", feature: "Feature", story: "User Story" };
  const lines = [headers.join(",")];
  items.forEach((it) => {
    lines.push([
      it.id, witLabel[it.type], it.title, it.description ?? "", it.parentId ?? "",
      it.effort ?? "", it.priority ?? "", it.quarter ?? "", it.state ?? "",
      it.tags ?? "", it.notes ?? "",
    ].map(esc).join(","));
  });
  return lines.join("\n");
}


// ---------- Roadmap rollup logic ----------

/** Busca un item por su ID visible (`id`), no por `uid`. */
function findById(items: RoadmapItem[], id?: string) {
  if (!id) return undefined;
  return items.find((i) => i.id === id);
}

/** All descendants of `item` (children, grandchildren, ...); a prueba de ciclos. */
export function descendantsOf(item: RoadmapItem, items: RoadmapItem[], seen = new Set<string>()): RoadmapItem[] {
  if (seen.has(item.uid)) return [];
  seen.add(item.uid);
  const kids = items.filter((c) => c.parentId === item.id && c.uid !== item.uid && !seen.has(c.uid));
  return kids.flatMap((k) => [k, ...descendantsOf(k, items, seen)]);
}

/** Topmost ancestor of `item`, walking up via parentId. Returns undefined if none. */
export function topAncestor(item: RoadmapItem, items: RoadmapItem[]): RoadmapItem | undefined {
  let cur: RoadmapItem | undefined = item;
  let top: RoadmapItem | undefined;
  const seen = new Set<string>();
  while (cur && cur.parentId && !seen.has(cur.uid)) {
    seen.add(cur.uid);
    const p = findById(items, cur.parentId);
    if (!p) break;
    top = p;
    cur = p;
  }
  return top;
}

/**
 * What % of an item's total leaf-effort is actually planned in the roadmap
 * (i.e. has an effective quarter and is not hidden).
 */
export function roadmapCoverage(item: RoadmapItem, items: RoadmapItem[]): { planned: number; total: number; pct: number } {
  const leaves: RoadmapItem[] = [];
  const collect = (n: RoadmapItem) => {
    const kids = items.filter((c) => c.parentId === n.id);
    if (kids.length === 0) leaves.push(n);
    else kids.forEach(collect);
  };
  collect(item);
  const total = leaves.reduce((s, l) => s + (l.effort || 0), 0);
  const planned = leaves
    .filter((l) => !l.hiddenFromRoadmap && effectiveQuarter(l, items) !== "")
    .reduce((s, l) => s + (l.effort || 0), 0);
  return { planned, total, pct: total > 0 ? (planned / total) * 100 : 0 };
}

/**
 * Effective quarter for an item, walking up the hierarchy:
 *   US.quarter > Feature.quarter > Epic.quarter
 */
export function effectiveQuarter(item: RoadmapItem, _items: RoadmapItem[]): Quarter {
  // Each item respects its own quarter. Cascading to descendants happens
  // explicitly in moveQuarter, so we no longer inherit from ancestors —
  // otherwise setting a child to "Backlog" would still render it under the
  // parent's quarter.
  return item.quarter || "";
}

/** Hijos directos de `parent` (relación por `parentId` = `id` del padre). */
function childrenOf(parent: RoadmapItem, items: RoadmapItem[]) {
  return items.filter((i) => i.parentId === parent.id);
}

/**
 * Returns the items to render in the roadmap, applying the rollup rules:
 * - Each epic / feature has a `displayMode`:
 *    - "self": always render the parent (rolled-up).
 *    - "children": always render its descendants individually.
 *    - "auto" (default): if all its descendants resolve to the same quarter,
 *      render the parent in that quarter. Otherwise render the children.
 *
 * The walker starts from epics → features → stories and prunes whatever a
 * higher level decides to roll up.
 */
export function buildRoadmapView(items: RoadmapItem[]): { item: RoadmapItem; quarter: Quarter; rolledUp: boolean }[] {
  const out: { item: RoadmapItem; quarter: Quarter; rolledUp: boolean }[] = [];
  const visited = new Set<string>();

  const allDescendants = (node: RoadmapItem): RoadmapItem[] => {
    const kids = childrenOf(node, items);
    return [...kids, ...kids.flatMap(allDescendants)];
  };

  /**
   * Returns the single shared quarter of all descendants (ignoring unassigned),
   * or null if descendants resolve to different quarters / none have a quarter.
   */
  const sharedChildQuarter = (node: RoadmapItem): Quarter | null => {
    const desc = allDescendants(node);
    if (desc.length === 0) return null;
    const quarters = new Set(desc.map((d) => effectiveQuarter(d, items)).filter(Boolean));
    if (quarters.size !== 1) return null;
    return [...quarters][0] as Quarter;
  };

  const decide = (node: RoadmapItem): { choice: "self" | "children"; quarter?: Quarter } => {
    const mode = node.displayMode ?? "auto";
    if (mode === "children") return { choice: "children" };
    const desc = allDescendants(node);
    if (desc.length === 0) return { choice: "self" };
    if (mode === "self") {
      const shared = sharedChildQuarter(node);
      return { choice: "self", quarter: shared ?? undefined };
    }
    // auto: el quarter del padre ya viene derivado de sus hijos (syncParentQuarters).
    //  - "MULTI" → los hijos están repartidos: se renderizan ellos, no el padre.
    //  - Q1..Q4 o "" → el padre se renderiza como tarjeta contenedora (colapsable).
    const own = effectiveQuarter(node, items);
    if (own === "MULTI") return { choice: "children" };
    return { choice: "self", quarter: own };
  };


  const walk = (node: RoadmapItem) => {
    if (visited.has(node.uid)) return;
    visited.add(node.uid);
    if (node.type === "story") {
      const q = effectiveQuarter(node, items);
      out.push({ item: node, quarter: q, rolledUp: false });
      return;
    }
    const decision = decide(node);
    if (decision.choice === "self") {
      const q = decision.quarter ?? effectiveQuarter(node, items);
      out.push({ item: node, quarter: q, rolledUp: childrenOf(node, items).length > 0 });
      // mark descendants as visited so we don't render them too
      allDescendants(node).forEach((d) => visited.add(d.uid));
    } else {
      childrenOf(node, items).forEach(walk);
    }
  };

  // Start with epics, then orphan features, then orphan stories.
  items.filter((i) => i.type === "epic").forEach(walk);
  items.filter((i) => i.type === "feature" && !visited.has(i.uid)).forEach(walk);
  items.filter((i) => i.type === "story" && !visited.has(i.uid)).forEach(walk);
  return out.filter((v) => !v.item.hiddenFromRoadmap);
}

/**
 * Effort committed in each quarter, computed only from leaf-level items
 * (stories, or features/epics without children) so we never double-count.
 */
export function effortByQuarter(items: RoadmapItem[]): Record<Quarter, number> {
  const acc: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, MULTI: 0, "": 0 };
  items.forEach((it) => {
    if (it.hiddenFromRoadmap) return;
    const hasKids = items.some((c) => c.parentId === it.id);
    if (hasKids) return;
    const q = effectiveQuarter(it, items);
    acc[q] += it.effort || 0;
  });
  return acc;
}

/**
 * Sum of effort of an item including all its descendants (leaves only count once).
 * Used to display roll-up effort on Epics/Features.
 */
export function rolledUpEffort(item: RoadmapItem, items: RoadmapItem[]): number {
  const kids = items.filter((c) => c.parentId === item.id);
  if (kids.length === 0) return item.effort || 0;
  return kids.reduce((s, k) => s + rolledUpEffort(k, items), 0);
}

/**
 * Normalize parent efforts so `parent.effort === Σ(children rolled-up effort)`.
 * Leaves (items without children) keep their own `effort` untouched.
 * Called from `saveItems` to keep stored data consistent with the display rule.
 */
export function syncParentEfforts(items: RoadmapItem[]): RoadmapItem[] {
  return items.map((it) => {
    const hasKids = items.some((c) => c.parentId === it.id);
    if (!hasKids) return it;
    const sum = rolledUpEffort(it, items);
    return it.effort === sum ? it : { ...it, effort: sum };
  });
}

/** Nº de work items por prioridad (incluye los no priorizados). */
export function countByPriority(items: RoadmapItem[]): Record<string, number> {
  const acc: Record<string, number> = { "1-High": 0, "2-Medium": 0, "3-Low": 0, "Sin prioridad": 0 };
  items.forEach((it) => {
    const k = it.priority || "Sin prioridad";
    acc[k] = (acc[k] || 0) + 1;
  });
  return acc;
}

/** Esfuerzo total por prioridad; solo cuenta hojas para no duplicar el del padre. */
export function effortByPriority(items: RoadmapItem[]): Record<string, number> {
  const acc: Record<string, number> = { "1-High": 0, "2-Medium": 0, "3-Low": 0, "Sin prioridad": 0 };
  items.forEach((it) => {
    const hasKids = items.some((c) => c.parentId === it.id);
    if (hasKids) return;
    const k = it.priority || "Sin prioridad";
    acc[k] = (acc[k] || 0) + (it.effort || 0);
  });
  return acc;
}
