// Roadmap data layer (localStorage, no backend yet)
export type ItemType = "epic" | "feature" | "story";
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4" | "";
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
  sprintsByQuarter?: Partial<Record<Exclude<Quarter, "">, number>>; // per-Q override
};

const ITEMS_KEY = "roadgate.roadmap.items";
const CFG_KEY = "roadgate.roadmap.capacity";

export const defaultCapacity: CapacityConfig = {
  developers: 7,
  dedicationPct: 30,
  daysPerSprint: 10,
  hoursPerDay: 5,
  sprintsPerQuarter: 5,
  sprintsByQuarter: {},
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadItems(): RoadmapItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    return raw ? (JSON.parse(raw) as RoadmapItem[]) : [];
  } catch {
    return [];
  }
}

export function saveItems(items: RoadmapItem[]) {
  if (!isBrowser()) return;
  // Enforce the invariant: parent.effort = Σ(children).
  // Done here (single write path) so every mutation stays consistent,
  // including CSV export and dashboards.
  const normalized = syncParentEffortsInternal(items);
  localStorage.setItem(ITEMS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event("roadgate:roadmap"));
}

// Local copy to avoid forward reference (syncParentEfforts is exported below).
function syncParentEffortsInternal(items: RoadmapItem[]): RoadmapItem[] {
  const rollup = (item: RoadmapItem): number => {
    const kids = items.filter((c) => c.parentId === item.id);
    if (kids.length === 0) return item.effort || 0;
    return kids.reduce((s, k) => s + rollup(k), 0);
  };
  return items.map((it) => {
    const hasKids = items.some((c) => c.parentId === it.id);
    if (!hasKids) return it;
    const sum = rollup(it);
    return it.effort === sum ? it : { ...it, effort: sum };
  });
}

export function loadCapacity(): CapacityConfig {
  if (!isBrowser()) return defaultCapacity;
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? { ...defaultCapacity, ...JSON.parse(raw) } : defaultCapacity;
  } catch {
    return defaultCapacity;
  }
}

export function saveCapacity(cfg: CapacityConfig) {
  if (!isBrowser()) return;
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event("roadgate:roadmap"));
}

export function sprintsForQuarter(c: CapacityConfig, q: Exclude<Quarter, "">) {
  const v = c.sprintsByQuarter?.[q];
  return typeof v === "number" && v >= 0 ? v : c.sprintsPerQuarter;
}
export function capacityPerSprint(c: CapacityConfig) {
  return c.developers * (c.dedicationPct / 100) * c.daysPerSprint * c.hoursPerDay;
}
export function capacityPerQuarter(c: CapacityConfig, q?: Exclude<Quarter, "">) {
  const sprints = q ? sprintsForQuarter(c, q) : c.sprintsPerQuarter;
  return capacityPerSprint(c) * sprints;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Minimal CSV parser supporting quoted fields and commas inside quotes
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
  const headers = filtered[0].map((h) => h.trim());
  return filtered.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
    return o;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const lk = k.toLowerCase().trim();
    if (keys.some((kk) => lk === kk.toLowerCase())) return row[k];
  }
  return "";
}

function detectType(raw: string, fallback: ItemType): ItemType {
  const v = raw.toLowerCase().trim();
  if (!v) return fallback;
  if (v.startsWith("epic")) return "epic";
  if (v.startsWith("feature")) return "feature";
  if (v.startsWith("user story") || v.startsWith("story") || v.startsWith("product backlog") || v === "pbi" || v === "task") return "story";
  return fallback;
}

function normalizePriority(raw: string): Priority {
  const v = raw.trim();
  if (!v) return "";
  if (/^1/.test(v) || /high/i.test(v) || /alta/i.test(v)) return "1-High";
  if (/^2/.test(v) || /med/i.test(v)) return "2-Medium";
  if (/^3|4/.test(v) || /low/i.test(v) || /baja/i.test(v)) return "3-Low";
  return (v as Priority) || "";
}

function normalizeQuarter(raw: string): Quarter {
  const m = raw.match(/Q[1-4]/i);
  return (m ? (m[0].toUpperCase() as Quarter) : "");
}

/**
 * Imports CSV. Supports Azure DevOps export headers:
 *  ID, Work Item Type, Title, Parent, State, Effort/Story Points, Priority,
 *  Iteration Path, Tags, Description.
 * If "Work Item Type" is missing, falls back to `defaultType` for every row.
 */
export function importCSV(text: string, defaultType: ItemType, existing: RoadmapItem[]): RoadmapItem[] {
  const rows = parseCSV(text);
  const newItems: RoadmapItem[] = rows.map((r) => {
    const wit = pick(r, ["work item type", "type", "item type"]);
    const type = detectType(wit, defaultType);
    const id = pick(r, ["id", "key", "work item id"]) || `${type.toUpperCase()}-${uid().slice(0, 4)}`;
    const iter = pick(r, ["iteration path", "iteration", "sprint"]);
    return {
      uid: uid(),
      id,
      type,
      title: pick(r, ["title", "name", "summary"]),
      description: pick(r, ["description", "desc"]),
      parentId: pick(r, ["parent", "parentid", "parent id", "parent work item"]) || undefined,
      effort: Number(pick(r, ["effort", "hours", "estimate", "story points", "original estimate"])) || undefined,
      priority: normalizePriority(pick(r, ["priority"])),
      quarter: normalizeQuarter(pick(r, ["quarter", "q"]) || iter),
      state: (pick(r, ["state", "status"]) as State) || "Backlog",
      notes: pick(r, ["notes", "comment", "comments"]),
      tags: pick(r, ["tags", "labels"]),
    };
  });
  // dedupe by id keeping new
  const map = new Map<string, RoadmapItem>();
  [...existing, ...newItems].forEach((it) => map.set(`${it.type}:${it.id}`, it));
  return [...map.values()];
}

export function toCSV(items: RoadmapItem[]): string {
  const headers = ["ID", "Work Item Type", "Title", "Description", "Parent", "Effort", "Priority", "Quarter", "State", "Tags", "Notes"];
  const witLabel: Record<ItemType, string> = { epic: "Epic", feature: "Feature", story: "User Story" };
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
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

function findById(items: RoadmapItem[], id?: string) {
  if (!id) return undefined;
  return items.find((i) => i.id === id);
}

/** All descendants of `item` (children, grandchildren, ...). */
export function descendantsOf(item: RoadmapItem, items: RoadmapItem[]): RoadmapItem[] {
  const kids = items.filter((c) => c.parentId === item.id);
  return [...kids, ...kids.flatMap((k) => descendantsOf(k, items))];
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
    if (mode === "self") {
      const shared = sharedChildQuarter(node);
      return { choice: "self", quarter: shared ?? undefined };
    }
    if (mode === "children") return { choice: "children" };
    // auto: never absorb children into the parent card. If the node has
    // descendants, render each descendant on its own quarter so the item the
    // user placed stays visible as itself (and keeps its own type/icon).
    const desc = allDescendants(node);
    if (desc.length === 0) return { choice: "self" };
    return { choice: "children" };
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
  const acc: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, "": 0 };
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

export function countByPriority(items: RoadmapItem[]): Record<string, number> {
  const acc: Record<string, number> = { "1-High": 0, "2-Medium": 0, "3-Low": 0, "Sin prioridad": 0 };
  items.forEach((it) => {
    const k = it.priority || "Sin prioridad";
    acc[k] = (acc[k] || 0) + 1;
  });
  return acc;
}

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
