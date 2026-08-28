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
 *  3. Semántica ÚNICA del gate de prioridad: ASIGNAR, nunca bloquear.
 *     Planificar nunca se rechaza por falta de prioridad; la prioridad se
 *     asigna automáticamente al item y a TODA su descendencia arrastrada, así
 *     que ningún hijo "se cuela" en el Roadmap sin prioridad.
 *       R1 Todo item nuevo nace con prioridad Baja (`DEFAULT_PRIORITY`).
 *       R2 Herencia estricta top-down: cambiar la prioridad de un padre la
 *          propaga a TODOS sus descendientes (los que siguen en Backlog).
 *       R3 Planificar (mover a Q1–Q4) fuerza Alta (o respeta Media) en toda la rama.
 *       R4 El Backlog no admite prioridad Alta; volver al Backlog rebaja la
 *          rama a Baja.
 *  4. Herencia de Quarter: mover un agrupador arrastra a toda su descendencia;
 *     mover un hijo suelto deja al padre en "MULTI" (lo calcula normalizeItems).
 *  5. Validación de jerarquía Epic → Feature → User Story al reasignar padre.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter, Priority,
  CapacityConfig, defaultCapacity, uid, normalizeItems, descendantsOf, rolledUpEffort,
} from "@/lib/roadmap";
import { fetchRoadmap, persistItems, persistCapacity } from "@/lib/api/roadgate";
import { nextPendingId } from "../pending-id";

/** Regla 1: prioridad por defecto de cualquier item nuevo o devuelto al Backlog. */
const DEFAULT_PRIORITY: Priority = "3-Low";
/** Regla 3: todo lo planificado en un Quarter es prioridad Alta. */
const HIGH: Priority = "1-High";
/**
 * @param roadmapId Id del roadmap a cargar.
 * @param userId    Id del usuario autenticado; sin él no se hidrata nada
 *                  (evita pedir datos durante SSR o antes del login).
 */
export function useRoadmapBoard(roadmapId: string, userId?: string) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [cfg, setCfg] = useState<CapacityConfig>(defaultCapacity);
  const [roadmapName, setRoadmapName] = useState<string>("");


  // Hidratación desde el backend al cambiar la identidad o el roadmap.
  useEffect(() => {
    if (!userId || !roadmapId) { setItems([]); setCfg(defaultCapacity); return; }
    let cancelled = false;
    fetchRoadmap({ roadmapId })
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
  }, [userId, roadmapId, navigate]);

  // Persistencia con debounce: ráfagas de ediciones colapsan en una escritura.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = (next: RoadmapItem[]) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistItems({ roadmapId, items: next }).catch((e) => {
        console.error(e); toast.error("Error al guardar en el backend");
      });
    }, 350);
  };
  useEffect(() => () => { if (persistTimer.current) clearTimeout(persistTimer.current); }, []);

  /**
   * Punto ÚNICO de escritura de items: normaliza (invariantes de esfuerzo y
   * quarter), refresca el estado local y programa el guardado con debounce.
   * Nunca llames a `setItems` directamente desde fuera de aquí.
   */
  const update = (next: RoadmapItem[]) => {
    const normalized = normalizeItems(next);
    setItems(normalized);
    schedulePersist(normalized);
  };

  /**
   * Guarda la capacidad con debounce: teclear en los inputs numéricos generaba
   * una escritura por pulsación (y respuestas fuera de orden).
   */
  const capacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (capacityTimer.current) clearTimeout(capacityTimer.current); }, []);
  const updateCapacity = (c: CapacityConfig) => {
    setCfg(c);
    if (capacityTimer.current) clearTimeout(capacityTimer.current);
    capacityTimer.current = setTimeout(() => {
      persistCapacity({ roadmapId, capacity: c }).catch((e) => {
        console.error(e); toast.error("Error al guardar capacity");
      });
    }, 400);
  };

  /**
   * Edición parcial de un item aplicando las reglas de negocio.
   * @param uidKey uid interno del item (no el ID visible).
   * @param patch  campos a modificar; los que violen una regla se descartan.
   *
   * Orden de evaluación: tipo inmutable → R4 (Alta solo en Roadmap) →
   * R4 inversa (quitar prioridad ⇒ Backlog en cascada) → jerarquía de padre →
   * R2 (herencia de prioridad a descendientes).
   */
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

    // Reglas 2 y 3 (degradación): bajar la prioridad a Baja/Mínima —o quitarla—
    // desplanifica el item y toda su rama (Quarter → No asignado).
    if ("priority" in safePatch) {
      const nextP = (safePatch.priority ?? "") as Priority | "";
      const demotes = nextP === "" || nextP === "3-Low" || nextP === "4-Lowest";
      const currentQ = ("quarter" in safePatch ? safePatch.quarter : current.quarter) ?? "";
      // Guarda anti-bucle: solo actuamos si realmente hay un cambio de estado.
      if (demotes && currentQ !== "") {
        const finalPriority: Priority = nextP === "" ? DEFAULT_PRIORITY : (nextP as Priority);
        const cascadeUids = new Set<string>([
          current.uid,
          ...descendantsOf(current, items).map((d) => d.uid),
        ]);
        update(
          items.map((it) =>
            cascadeUids.has(it.uid)
              ? { ...it, quarter: "" as Quarter, priority: finalPriority }
              : it,
          ),
        );
        toast.info("Movido al Backlog", {
          description: `${current.id}: prioridad baja — se quitó del Roadmap (rama incluida).`,
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

    // Regla 2: herencia top-down de la prioridad, pero SOLO hacia los
    // descendientes que están en el Backlog. Los descendientes ya planificados
    // en un Quarter son Alta por definición (Regla 3) y no deben degradarse
    // porque el padre tenga Media/Baja.
    const inheritUids =
      "priority" in safePatch
        ? new Set(
            descendantsOf(current, items)
              .filter((d) => (d.quarter ?? "") === "")
              .map((d) => d.uid),
          )
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
    // Gate de planificación: sin esfuerzo (propio o de sus hojas) el item no
    // aportaría carga al Quarter, así que se bloquea el movimiento.
    if (planning && rolledUpEffort(target, items) <= 0) {
      toast.error("No se puede planificar sin esfuerzo", {
        description: `${target.id}: asigna las horas de esfuerzo${
          descendantsOf(target, items).length ? " en sus hijos" : ""
        } antes de moverlo a ${quarter}.`,
      });
      return;
    }
    // En el Roadmap solo caben Alta o Media: se respeta Media si ya la tenía,
    // el resto (Baja/Mínima/sin prioridad) sube a Alta.
    const priorityFor = (it: { priority?: string }) =>
      planning ? (it.priority === "2-Medium" ? "2-Medium" : HIGH) : DEFAULT_PRIORITY;
    // Herencia en bloque: el padre impone quarter y prioridad a toda su descendencia.
    const cascadeUids = new Set<string>([target.uid, ...descendantsOf(target, items).map((d) => d.uid)]);
    update(items.map((it) => (cascadeUids.has(it.uid) ? { ...it, quarter, priority: priorityFor(it) as typeof it.priority } : it)));
    toast.success(planning ? `Movido a ${quarter}` : "Movido a Backlog", {
      description: `${target.id}: prioridad ${planning ? "Alta/Media" : "Baja"} aplicada a la rama.`,
    });

  };

  /** Elimina un item. Sus hijos quedan con `parentId` colgado y se tratan como raíces. */
  const remove = (uidKey: string) => update(items.filter((it) => it.uid !== uidKey));

  /**
   * Crea un item del tipo indicado con un ID correlativo libre (EPIC-01, FEAT-03…).
   * El bucle `while` evita colisiones cuando el usuario ha editado IDs a mano.
   * Nace en Backlog y, por la Regla 1, con prioridad Baja.
   */
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

  /**
   * Alta manual detallada (pop-up "+" del Backlog).
   * El ID definitivo lo asigna la herramienta de iteraciones, así que el item
   * nace con un ID temporal `TBD-xx` marcado como pendiente de actualizar.
   * Si se planifica en un Quarter se aplica la Regla 3 (Alta, o Media si ya lo era).
   */
  const addDetailed = (type: ItemType, draft: Omit<RoadmapItem, "uid" | "id" | "type">) => {
    const planning = !!draft.quarter && draft.quarter !== "MULTI";
    const priority: Priority = planning
      ? (draft.priority === "2-Medium" ? "2-Medium" : HIGH)
      : ((draft.priority || DEFAULT_PRIORITY) as Priority);
    const newItem: RoadmapItem = {
      ...draft,
      uid: uid(),
      id: nextPendingId(items.map((i) => i.id)),
      type,
      title: draft.title || `${t("roadmap.new")} ${type}`,
      priority,
      state: draft.state ?? "Backlog",
    };
    update([...items, newItem]);
    toast.success(t("roadmap.newItem.created"), { description: newItem.id });
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
    update, updateOne, updateCapacity, moveQuarter, remove, add, addDetailed, removeAllOfType,
  };
}
