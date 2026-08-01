import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter,
  CapacityConfig, defaultCapacity, uid, normalizeItems, descendantsOf,
} from "@/lib/roadmap";
import { fetchRoadmap, persistItems, persistCapacity } from "@/lib/roadmap.functions";
import { hasAssignedPriority } from "../constants";

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
    // Gate de priorización: no permitir asignar Quarter sin prioridad definida
    if ("quarter" in safePatch && safePatch.quarter && !hasAssignedPriority(current.priority) && !hasAssignedPriority(safePatch.priority)) {
      toast.error("No se puede añadir al Roadmap sin prioridad", {
        description: "Define la prioridad antes de asignar un Quarter.",
      });
      delete safePatch.quarter;
    }
    // Regla de negocio: solo se devuelve al Backlog si se quita la prioridad ("Sin prioridad").
    // Baja y Muy baja pueden permanecer en el Roadmap.
    if ("priority" in safePatch) {
      const nextPriority = safePatch.priority ?? "";
      const demote = nextPriority === "";
      if (demote && (current.quarter ?? "") !== "") {
        safePatch.quarter = "";
        const cascadeUids = new Set<string>([
          current.uid,
          ...descendantsOf(current, items).map((d) => d.uid),
        ]);
        update(
          items.map((it) =>
            cascadeUids.has(it.uid)
              ? { ...it, ...(it.uid === current.uid ? safePatch : {}), quarter: "" as Quarter }
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
    update(items.map((it) => (it.uid === uidKey ? { ...it, ...safePatch } : it)));
  };

  /**
   * Mueve un item a un quarter.
   * Si es un agrupador (Epic/Feature), TODOS sus descendientes heredan ese quarter.
   * Si luego se mueve un hijo suelto, `normalizeItems` recalcula el padre a "MULTI".
   */
  const moveQuarter = (uidKey: string, quarter: Quarter) => {
    const target = items.find((i) => i.uid === uidKey);
    if (!target) return;
    if (target.quarter === quarter) return;
    if (quarter && quarter !== "MULTI" && !hasAssignedPriority(target.priority)) {
      toast.error("No se puede añadir al Roadmap sin prioridad", {
        description: `${target.id}: define la prioridad antes de asignar un Quarter.`,
      });
      return;
    }
    // Herencia en bloque: el padre impone su quarter a toda su descendencia.
    const cascadeUids = new Set<string>([target.uid, ...descendantsOf(target, items).map((d) => d.uid)]);
    update(items.map((it) => (cascadeUids.has(it.uid) ? { ...it, quarter } : it)));
    toast.success(quarter ? `Movido a ${quarter}` : "Movido a Backlog", {
      description: `${target.id}: ${target.title}`,
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
