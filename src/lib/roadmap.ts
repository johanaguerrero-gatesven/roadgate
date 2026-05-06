// Roadmap data layer (localStorage, no backend yet)
export type ItemType = "epic" | "feature" | "story";
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4" | "";
export type Priority = "1-High" | "2-Medium" | "3-Low" | "";
export type State = "Backlog" | "In Progress" | "Done" | "Blocked";

export type RoadmapItem = {
  id: string;            // user-facing ID (e.g. EPIC-01)
  uid: string;           // internal unique id
  type: ItemType;
  title: string;
  description?: string;
  parentId?: string;     // references another item.id
  effort?: number;       // hours
  priority?: Priority;
  quarter?: Quarter;
  state?: State;
  notes?: string;
};

export type CapacityConfig = {
  developers: number;
  dedicationPct: number;   // 0..100
  daysPerSprint: number;
  hoursPerDay: number;
  sprintsPerQuarter: number;
};

const ITEMS_KEY = "roadgate.roadmap.items";
const CFG_KEY = "roadgate.roadmap.capacity";

export const defaultCapacity: CapacityConfig = {
  developers: 7,
  dedicationPct: 30,
  daysPerSprint: 10,
  hoursPerDay: 5,
  sprintsPerQuarter: 5,
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
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("roadgate:roadmap"));
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

export function capacityPerSprint(c: CapacityConfig) {
  return c.developers * (c.dedicationPct / 100) * c.daysPerSprint * c.hoursPerDay;
}
export function capacityPerQuarter(c: CapacityConfig) {
  return capacityPerSprint(c) * c.sprintsPerQuarter;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Minimal CSV parser supporting quoted fields and commas inside quotes
export function parseCSV(text: string): Record<string, string>[] {
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
    if (keys.some((kk) => k.toLowerCase() === kk.toLowerCase())) return row[k];
  }
  return "";
}

export function importCSV(text: string, type: ItemType, existing: RoadmapItem[]): RoadmapItem[] {
  const rows = parseCSV(text);
  const newItems: RoadmapItem[] = rows.map((r) => {
    const id = pick(r, ["id", "ID", "key"]) || `${type.toUpperCase()}-${uid().slice(0, 4)}`;
    return {
      uid: uid(),
      id,
      type,
      title: pick(r, ["title", "name", "summary"]),
      description: pick(r, ["description", "desc"]),
      parentId: pick(r, ["parent", "parentId", "parent id"]) || undefined,
      effort: Number(pick(r, ["effort", "hours", "estimate"])) || undefined,
      priority: (pick(r, ["priority"]) as Priority) || "",
      quarter: (pick(r, ["quarter", "q"]) as Quarter) || "",
      state: (pick(r, ["state", "status"]) as State) || "Backlog",
      notes: pick(r, ["notes", "comment"]),
    };
  });
  // dedupe by id keeping new
  const map = new Map<string, RoadmapItem>();
  [...existing, ...newItems].forEach((it) => map.set(`${it.type}:${it.id}`, it));
  return [...map.values()];
}

export function toCSV(items: RoadmapItem[]): string {
  const headers = ["id", "type", "title", "description", "parent", "effort", "priority", "quarter", "state", "notes"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[\",\n]/.test(s) ? `"${s.replace(/\"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  items.forEach((it) => {
    lines.push([it.id, it.type, it.title, it.description ?? "", it.parentId ?? "", it.effort ?? "", it.priority ?? "", it.quarter ?? "", it.state ?? "", it.notes ?? ""].map(esc).join(","));
  });
  return lines.join("\n");
}
