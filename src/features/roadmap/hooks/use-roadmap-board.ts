/**
 * =============================================================================
 * useRoadmapBoard — motor de reglas de negocio de un roadmap
 * =============================================================================
 * Concentra TODO el estado y las reglas de un roadmap concreto. Las rutas y los
 * componentes son "tontos": solo pintan y llaman a las acciones que expone.
 *
 * Responsabilidades:
 *  1. Hidratación desde el backend y persistencia con debounce (350 ms).
 *  2. Invariantes de datos vía `normalizeItems` en cada escritura:
 *       - esfuerzo del padre = Σ esfuerzo de sus hojas
 *       - quarter del padre derivado de sus hijos (Q concreto | "MULTI" | "")
 *  3. Reglas de priorización de RoadGate:
 *       R1 Todo item nuevo nace con prioridad Baja (`DEFAULT_PRIORITY`).
 *       R2 Herencia estricta top-down: cambiar la prioridad de un padre la
 *          propaga a TODOS sus descendientes.
 *       R3 Planificar (mover a Q1–Q4) fuerza prioridad Alta en toda la rama.
 *       R4 El Backlog no admite prioridad Alta; volver al Backlog rebaja la
 *          rama a Baja.
 *  4. Herencia de Quarter: mover un agrupador arrastra a toda su descendencia;
 *     mover un hijo suelto deja al padre en "MULTI" (lo calcula normalizeItems).
 *  5. Validación de jerarquía Epic → Feature → User Story al reasignar padre.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter, Priority,
  CapacityConfig, defaultCapacity, uid, normalizeItems, descendantsOf,
} from "@/lib/roadmap";
import { fetchRoadmap, persistItems, persistCapacity } from "@/lib/roadmap.functions";

/** Regla 1: prioridad por defecto de cualquier item nuevo o devuelto al Backlog. */
const DEFAULT_PRIORITY: Priority = "3-Low";
/** Regla 3: todo lo planificado en un Quarter es prioridad Alta. */
const HIGH: Priority = "1-High";



/**
 * Estado + reglas de negocio de un roadmap concreto:
 * carga, persistencia con debounce, gate de priorización, cascada de quarter
 * a los descendientes y validación de jerarquía Epic → Feature → User Story.
 *
 * La UI (rutas y componentes) solo consume las acciones que expone este hook.
 */
export function useRoadmapBoard(roadmapId: string, userId?: string) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [cfg, setCfg] = useState<CapacityConfig>(defaultCapacity);
  const [roadmapName, setRoadmapName] = useState<string>("");

  const fetchRoadmapFn = useServerFn(fetchRoadmap);
  const persistItemsFn = useServerFn(persistItems);
  const persistCapacityFn = useServerFn(persistCapacity);

  // Hidratación desde el backend al cambiar la identidad o el roadmap.
  useEffect(() => {
    if (!userId || !roadmapId) { setItems([]); setCfg(defaultCapacity); return; }
    let cancelled = false;
    fetchRoadmapFn({ data: { roadmapId } })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setCfg(r.capacity);
        setRoadmapName(r.roadmap.name);
      })
      .catch((e) => {
        console.error(e);
        toast.error("No se pudo cargar el roadmap");
        navigate({ to: "/roadmaps" });
      });
    return () => { cancelled = true; };
  }, [userId, roadmapId, fetchRoadmapFn, navigate]);

  // Persistencia con debounce: ráfagas de ediciones colapsan en una escritura.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = (next: RoadmapItem[]) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistItemsFn({ data: { roadmapId, items: next } }).catch((e) => {
        console.error(e); toast.error("Error al guardar en el backend");
      });
    }, 350);
  };
  useEffect(() => () => { if (persistTimer.current) clearTimeout(persistTimer.current); }, []);

  const update = (next: RoadmapItem[]) => {
    const normalized = normalizeItems(next);
    setItems(normalized);
    schedulePersist(normalized);
  };

  const updateCapacity = (c: CapacityConfig) => {
    setCfg(c);
    persistCapacityFn({ data: { roadmapId, capacity: c } }).catch((e) => {
      console.error(e); toast.error("Error al guardar capacity");
    });
  };

  const updateOne = (uidKey: string, patch: Partial<RoadmapItem>) => {
    const current = items.find((i) => i.uid === uidKey);
    if (!current) return;
    const safePatch = { ...patch };
    // Nunca permitir sobrescribir el tipo original
    if ("type" in safePatch) delete (safePatch as { type?: ItemType }).type;

    // Regla 4: el Backlog (sin Quarter) no admite prioridad HIGH.
    if ("priority" in safePatch && safePatch.priority === HIGH) {
      const nextQ = ("quarter" in safePatch ? safePatch.quarter : current.quarter) ?? "";
      if (nextQ === "") {
        toast.error("La prioridad Alta es exclusiva del Roadmap", {
          description: `${current.id}: asígnale un Quarter para marcarlo como Alta.`,
        });
        delete safePatch.priority;
      }
    }

    // Regla 4 (inversa): quitar la prioridad devuelve el item (y su rama) al Backlog.
    if ("priority" in safePatch) {
      const demote = (safePatch.priority ?? "") === "";
      if (demote && (current.quarter ?? "") !== "") {
        const cascadeUids = new Set<string>([
          current.uid,
          ...descendantsOf(current, items).map((d) => d.uid),
        ]);
        update(
          items.map((it) =>
            cascadeUids.has(it.uid)
              ? { ...it, quarter: "" as Quarter, priority: DEFAULT_PRIORITY }
              : it,
          ),
        );
        toast.info("Movido al Backlog", {
          description: `${current.id}: sin prioridad — se quitó del Roadmap.`,
        });
        return;
      }
    }

    // Validar parentId según el tipo
    if ("parentId" in safePatch) {
      const pid = safePatch.parentId;
      if (pid) {
        const parent = items.find((i) => i.id === pid);
        const allowed =
          current.type === "feature" ? parent?.type === "epic"
          : current.type === "story" ? (parent?.type === "epic" || parent?.type === "feature")
          : false;
        if (!allowed) {
          toast.error("Padre no permitido para este tipo de tarea");
          delete safePatch.parentId;
        }
      }
    }
    if (Object.keys(safePatch).length === 0) return;

    // Regla 2: herencia estricta top-down de la prioridad hacia los descendientes.
    const inheritUids =
      "priority" in safePatch
        ? new Set(descendantsOf(current, items).map((d) => d.uid))
        : new Set<string>();

    update(items.map((it) => {
      if (it.uid === uidKey) return { ...it, ...safePatch };
      if (inheritUids.has(it.uid)) return { ...it, priority: safePatch.priority };
      return it;
    }));
    if (inheritUids.size > 0) {
      toast.info("Prioridad heredada", {
        description: `${inheritUids.size} descendiente(s) actualizados a la prioridad de ${current.id}.`,
      });
    }
  };

  /**
   * Mueve un item a un quarter.
   * - Si es un agrupador (Epic/Feature), TODOS sus descendientes heredan ese quarter.
   * - Regla 3: planificar en un Quarter fuerza prioridad Alta (en cascada).
   * - Regla 4: devolver al Backlog rebaja la prioridad a la de por defecto (Baja).
   */
  const moveQuarter = (uidKey: string, quarter: Quarter) => {
    const target = items.find((i) => i.uid === uidKey);
    if (!target) return;
    if (target.quarter === quarter) return;
    const planning = quarter !== "" && quarter !== "MULTI";
    const nextPriority = planning ? HIGH : DEFAULT_PRIORITY;
    // Herencia en bloque: el padre impone quarter y prioridad a toda su descendencia.
    const cascadeUids = new Set<string>([target.uid, ...descendantsOf(target, items).map((d) => d.uid)]);
    update(items.map((it) => (cascadeUids.has(it.uid) ? { ...it, quarter, priority: nextPriority } : it)));
    toast.success(planning ? `Movido a ${quarter}` : "Movido a Backlog", {
      description: `${target.id}: prioridad ${planning ? "Alta" : "Baja"} aplicada a la rama.`,
    });
  };

  const remove = (uidKey: string) => update(items.filter((it) => it.uid !== uidKey));

  /** Crea un item del tipo indicado con un ID correlativo libre. */
  const add = (type: ItemType) => {
    const prefix = type === "epic" ? "EPIC" : type === "feature" ? "FEAT" : "US";
    const used = new Set(items.filter((i) => i.type === type).map((i) => i.id));
    let n = items.filter((i) => i.type === type).length + 1;
    let newId = `${prefix}-${String(n).padStart(2, "0")}`;
    while (used.has(newId)) { n += 1; newId = `${prefix}-${String(n).padStart(2, "0")}`; }
    update([...items, {
      uid: uid(), id: newId, type,
      title: `${t("roadmap.new")} ${type}`, state: "Backlog",
      // Regla 1: prioridad Baja por defecto.
      priority: DEFAULT_PRIORITY,
    }]);
  };

  /** Borra todos los items de un tipo y desvincula a sus huérfanos. */
  const removeAllOfType = (type: ItemType) => {
    const removedIds = new Set(items.filter((i) => i.type === type).map((i) => i.id));
    update(
      items
        .filter((i) => i.type !== type)
        .map((i) => (i.parentId && removedIds.has(i.parentId) ? { ...i, parentId: undefined } : i)),
    );
  };

  return {
    items, cfg, roadmapName,
    update, updateOne, updateCapacity, moveQuarter, remove, add, removeAllOfType,
  };
}
