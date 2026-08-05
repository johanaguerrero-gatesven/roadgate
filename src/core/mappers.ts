/**
 * =============================================================================
 * Mappers: base de datos (snake_case) ↔ dominio (camelCase)
 * =============================================================================
 * Único lugar del sistema donde se conoce la forma física de las tablas.
 * Ni los servicios ni los adaptadores deben leer columnas directamente: si
 * mañana cambia el esquema, sólo se toca este fichero.
 *
 * Reglas de normalización:
 *  - Los `null` de BD se traducen a `undefined` (campos opcionales) o a cadena
 *    vacía, para que la lógica de negocio nunca distinga entre ambos.
 *  - Al escribir se usa `|| null` (no `??`) en `priority` y `quarter`: la
 *    cadena vacía significa "sin asignar" y debe guardarse como NULL.
 */
import type {
  CapacityConfig,
  DisplayMode,
  ItemType,
  Priority,
  Quarter,
  RoadmapItem,
  State,
} from "@/lib/roadmap";
import { defaultCapacity } from "@/lib/roadmap";

/** Fila tal cual llega de `roadmap_items`. */
export type ItemRow = {
  item_uid: string;
  item_code: string;
  type: string;
  title: string;
  description: string | null;
  parent_id: string | null;
  effort: number | string | null;
  priority: string | null;
  quarter: string | null;
  sprint: number | null;
  state: string | null;
  notes: string | null;
  tags: string | null;
  display_mode: string | null;
  hidden_from_roadmap: boolean;
};

/** Fila tal cual llega de `roadmap_capacity`. */
export type CapacityRow = {
  developers: number;
  dedication_pct: number | string;
  days_per_sprint: number;
  hours_per_day: number | string;
  sprints_per_quarter: number;
  sprints_by_quarter: Record<string, number> | null;
  hours_by_quarter: Record<string, number> | null;
};

/**
 * Fila de `roadmap_items` → work item de dominio.
 * `item_uid` es la clave estable en cliente (drag & drop, edición) y
 * `item_code` el ID visible que usan los hijos como `parentId`.
 */
export function rowToItem(r: ItemRow): RoadmapItem {
  return {
    uid: r.item_uid,
    id: r.item_code,
    type: r.type as ItemType,
    title: r.title ?? "",
    description: r.description ?? undefined,
    parentId: r.parent_id ?? undefined,
    effort: r.effort == null ? undefined : Number(r.effort),
    priority: (r.priority ?? "") as Priority,
    quarter: (r.quarter ?? "") as Quarter,
    sprint: r.sprint ?? undefined,
    state: (r.state ?? "Backlog") as State,
    notes: r.notes ?? undefined,
    tags: r.tags ?? undefined,
    displayMode: (r.display_mode ?? undefined) as DisplayMode | undefined,
    hiddenFromRoadmap: !!r.hidden_from_roadmap,
  };
}

/** Work item de dominio → fila insertable en `roadmap_items`. */
export function itemToRow(it: RoadmapItem, userId: string, roadmapId: string) {
  return {
    user_id: userId,
    roadmap_id: roadmapId,
    item_uid: it.uid,
    item_code: it.id,
    type: it.type,
    title: it.title ?? "",
    description: it.description ?? null,
    parent_id: it.parentId ?? null,
    effort: it.effort ?? null,
    priority: it.priority || null,
    quarter: it.quarter || null,
    sprint: it.sprint ?? null,
    state: it.state ?? null,
    notes: it.notes ?? null,
    tags: it.tags ?? null,
    display_mode: it.displayMode ?? null,
    hidden_from_roadmap: !!it.hiddenFromRoadmap,
  };
}

/**
 * Fila de `roadmap_capacity` → configuración de dominio.
 * Si el roadmap todavía no tiene fila se devuelve `defaultCapacity`, de forma
 * que la UI y la API pueden trabajar sin necesitar un guardado previo.
 */
export function rowToCapacity(row: CapacityRow | null): CapacityConfig {
  if (!row) return defaultCapacity;
  return {
    developers: row.developers,
    dedicationPct: Number(row.dedication_pct),
    daysPerSprint: row.days_per_sprint,
    hoursPerDay: Number(row.hours_per_day),
    sprintsPerQuarter: row.sprints_per_quarter,
    sprintsByQuarter: (row.sprints_by_quarter ?? {}) as CapacityConfig["sprintsByQuarter"],
    hoursByQuarter: (row.hours_by_quarter ?? {}) as CapacityConfig["hoursByQuarter"],
  };
}

/** Configuración de dominio → fila insertable en `roadmap_capacity`. */
export function capacityToRow(c: CapacityConfig, userId: string, roadmapId: string) {
  return {
    user_id: userId,
    roadmap_id: roadmapId,
    developers: c.developers,
    dedication_pct: c.dedicationPct,
    days_per_sprint: c.daysPerSprint,
    hours_per_day: c.hoursPerDay,
    sprints_per_quarter: c.sprintsPerQuarter,
    sprints_by_quarter: c.sprintsByQuarter ?? {},
    hours_by_quarter: c.hoursByQuarter ?? {},
  };
}
