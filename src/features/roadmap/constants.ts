/**
 * =============================================================================
 * Constantes y metadatos visuales del módulo Roadmap
 * =============================================================================
 * Punto único de verdad para los valores enumerados (Quarters, prioridades,
 * tipos de work item) y su representación visual (iconos y colores).
 * Regla: ningún componente debe redefinir estas listas ni sus colores.
 */
import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown } from "lucide-react";
import type { ItemType, Priority, RealQuarter } from "@/lib/roadmap";

export type { RealQuarter };
/** Prioridad efectivamente asignada (excluye el estado "sin prioridad"). */
export type RealPriority = Exclude<Priority, "">;

/** Quarters seleccionables. "MULTI" no está aquí: es un estado derivado, no elegible. */
export const QUARTERS: RealQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
/** Prioridades ordenadas de mayor a menor. La Alta es exclusiva de items planificados. */
export const PRIORITIES: RealPriority[] = ["1-High", "2-Medium", "3-Low", "4-Lowest"];

/** Jerarquía RoadGate: Epic → Feature → User Story. */
export const ALL_TYPES: ItemType[] = ["epic", "feature", "story"];
export const TYPE_LABEL: Record<ItemType, string> = {
  epic: "Epics",
  feature: "Features",
  story: "User Stories",
};

/** Type guard: indica si el item tiene una prioridad real asignada. */
export const hasAssignedPriority = (priority?: Priority): priority is RealPriority =>
  PRIORITIES.includes(priority as RealPriority);

/** Visuales de prioridad estilo Jira. */
export const PRIORITY_META: Record<
  RealPriority,
  { icon: typeof ChevronsUp; cls: string; label: string; short: string }
> = {
  "1-High": { icon: ChevronsUp, cls: "text-red-600", label: "High", short: "1" },
  "2-Medium": { icon: ChevronUp, cls: "text-amber-600", label: "Medium", short: "2" },
  "3-Low": { icon: ChevronDown, cls: "text-sky-600", label: "Low", short: "3" },
  "4-Lowest": { icon: ChevronsDown, cls: "text-slate-500", label: "Lowest", short: "4" },
};

/** Color de la barra de utilización según el % de ocupación. */
export const utilizationBarColor = (pct: number) =>
  pct === 0 ? "bg-muted" : pct > 100 ? "bg-destructive" : pct < 50 ? "bg-amber-500" : "bg-emerald-500";

/** Color asociado a cada prioridad en los gráficos del dashboard. */
export const priorityBarColor = (p: string) =>
  p === "1-High"
    ? "bg-destructive"
    : p === "2-Medium"
      ? "bg-amber-500"
      : p === "3-Low"
        ? "bg-emerald-500"
        : "bg-muted-foreground/40";

// --- Preferencia local: tipos de work item activos en el Backlog ---
const ENABLED_TYPES_KEY = "roadgate.roadmap.enabledTypes";

export function loadEnabledTypes(): ItemType[] {
  if (typeof window === "undefined") return ALL_TYPES;
  try {
    const raw = localStorage.getItem(ENABLED_TYPES_KEY);
    if (!raw) return ALL_TYPES;
    const parsed = JSON.parse(raw) as ItemType[];
    const filtered = parsed.filter((t) => ALL_TYPES.includes(t));
    return filtered.length ? filtered : ALL_TYPES;
  } catch {
    return ALL_TYPES;
  }
}

export function saveEnabledTypes(types: ItemType[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENABLED_TYPES_KEY, JSON.stringify(types));
}
