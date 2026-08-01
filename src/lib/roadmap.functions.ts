/**
 * =============================================================================
 * Capa de persistencia de RoadGate (server functions)
 * =============================================================================
 * Único punto de entrada del cliente al backend para leer/escribir roadmaps.
 *
 * Reglas transversales:
 *  - Todas las funciones exigen sesión (`requireSupabaseAuth`) y operan como el
 *    usuario autenticado, por lo que RLS aplica además de los filtros `user_id`.
 *  - Antes de tocar los datos de un roadmap concreto se comprueba la propiedad
 *    con `assertRoadmapOwned` (defensa en profundidad frente a RLS).
 *  - El dominio (camelCase, ver `./roadmap`) y la base de datos (snake_case)
 *    se traducen exclusivamente en `rowToItem` / `itemToRow`.
 *
 * Modelo de datos:
 *  - `roadmaps`          → cabecera (id, nombre) de cada hoja de ruta.
 *  - `roadmap_items`     → Epics / Features / User Stories de un roadmap.
 *  - `roadmap_capacity`  → configuración de capacidad (1 fila por roadmap).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  defaultCapacity,
  type CapacityConfig,
  type DisplayMode,
  type ItemType,
  type Priority,
  type Quarter,
  type RoadmapItem,
  type State,
} from "./roadmap";

/** Fila tal cual llega de la tabla `roadmap_items` (snake_case, nullables). */
type ItemRow = {
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

/**
 * Adapta una fila de BD al modelo de dominio.
 * Los `null` se normalizan a `undefined` o a cadena vacía según el campo, para
 * que la lógica de negocio nunca tenga que distinguir entre ambos.
 * Ojo: `item_uid` es la clave estable en cliente (drag & drop, edición) y
 * `item_code` es el ID visible/editable por el usuario (EPIC-01, 14385, …).
 */
function rowToItem(r: ItemRow): RoadmapItem {
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

/**
 * Adapta un item de dominio a fila insertable.
 * `priority` y `quarter` usan `|| null` (no `??`) a propósito: la cadena vacía
 * significa "sin asignar" y debe guardarse como NULL, no como "".
 */
function itemToRow(it: RoadmapItem, userId: string, roadmapId: string) {
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
 * Verifica que el roadmap pertenece al usuario de la sesión.
 * Se ejecuta antes de cualquier lectura/escritura de items o capacidad para
 * garantizar el aislamiento de datos entre cuentas (además de RLS).
 * @throws Error("Roadmap not found") si no existe o no es del usuario.
 */
async function assertRoadmapOwned(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> } } } } },
  roadmapId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("roadmaps").select("id").eq("id", roadmapId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Roadmap not found");
}

/**
 * Lista los roadmaps del usuario (más recientes primero) enriquecidos con el
 * número de work items de cada uno, en una única consulta agregada en memoria
 * para evitar N+1.
 */

export const listRoadmaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("roadmaps")
      .select("id, name, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // enrich with counts
    const ids = (data ?? []).map((r) => r.id as string);
    let countsByRoadmap: Record<string, number> = {};
    if (ids.length) {
      const { data: rows, error: e2 } = await supabase
        .from("roadmap_items").select("roadmap_id").in("roadmap_id", ids);
      if (e2) throw new Error(e2.message);
      countsByRoadmap = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        const rid = (r as { roadmap_id: string }).roadmap_id;
        acc[rid] = (acc[rid] ?? 0) + 1;
        return acc;
      }, {});
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      itemCount: countsByRoadmap[r.id as string] ?? 0,
    }));
  });

/**
 * KPIs del workspace mostrados en la portada del usuario.
 * `totalFTE` = Σ(developers × dedicationPct/100) de todas las configuraciones
 * de capacidad, es decir el equivalente a personas a tiempo completo.
 */
export const getWorkspaceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [rmRes, capRes] = await Promise.all([
      supabase.from("roadmaps").select("id").eq("user_id", userId),
      supabase
        .from("roadmap_capacity")
        .select("roadmap_id, developers, dedication_pct")
        .eq("user_id", userId),
    ]);
    if (rmRes.error) throw new Error(rmRes.error.message);
    if (capRes.error) throw new Error(capRes.error.message);
    const roadmapsCount = (rmRes.data ?? []).length;
    const caps = (capRes.data ?? []) as Array<{
      roadmap_id: string;
      developers: number;
      dedication_pct: number | string;
    }>;
    const teamsCount = caps.length;
    const totalFTE = caps.reduce(
      (acc, c) => acc + Number(c.developers ?? 0) * (Number(c.dedication_pct ?? 0) / 100),
      0,
    );
    const totalDevelopers = caps.reduce((acc, c) => acc + Number(c.developers ?? 0), 0);
    return { roadmapsCount, teamsCount, totalFTE, totalDevelopers };
  });

/**
 * Crea un roadmap vacío (sin items ni capacidad) y devuelve su id para navegar.
 * Si no se indica nombre se usa un título por defecto.
 */
export const createRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const name = (data.name ?? "").trim() || "Hoja de ruta sin título";
    const { data: row, error } = await supabase
      .from("roadmaps").insert({ user_id: userId, name }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Renombra un roadmap del usuario. El nombre vacío se rechaza. */
export const renameRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Name required");
    const { error } = await supabase
      .from("roadmaps").update({ name }).eq("id", data.roadmapId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Borra un roadmap del usuario; items y capacidad caen por ON DELETE CASCADE. */
export const deleteRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("roadmaps").delete().eq("id", data.roadmapId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Carga completa de un roadmap: items, capacidad y cabecera en paralelo.
 * Si el roadmap todavía no tiene fila de capacidad se devuelve `defaultCapacity`
 * para que la UI pueda trabajar sin necesidad de un guardado previo.
 */
export const fetchRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRoadmapOwned(supabase as never, data.roadmapId, userId);
    const [itemsRes, capRes, rmRes] = await Promise.all([
      supabase.from("roadmap_items").select("*").eq("roadmap_id", data.roadmapId),
      supabase.from("roadmap_capacity").select("*").eq("roadmap_id", data.roadmapId).maybeSingle(),
      supabase.from("roadmaps").select("id, name").eq("id", data.roadmapId).single(),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (capRes.error) throw new Error(capRes.error.message);
    if (rmRes.error) throw new Error(rmRes.error.message);
    const items = ((itemsRes.data ?? []) as unknown as ItemRow[]).map(rowToItem);
    const capRow = capRes.data as unknown as {
      developers: number; dedication_pct: number | string; days_per_sprint: number;
      hours_per_day: number | string; sprints_per_quarter: number;
      sprints_by_quarter: Record<string, number> | null;
    } | null;
    const capacity: CapacityConfig = capRow
      ? {
          developers: capRow.developers,
          dedicationPct: Number(capRow.dedication_pct),
          daysPerSprint: capRow.days_per_sprint,
          hoursPerDay: Number(capRow.hours_per_day),
          sprintsPerQuarter: capRow.sprints_per_quarter,
          sprintsByQuarter: (capRow.sprints_by_quarter ?? {}) as CapacityConfig["sprintsByQuarter"],
        }
      : defaultCapacity;
    const rm = rmRes.data as { id: string; name: string };
    return { items, capacity, roadmap: { id: rm.id, name: rm.name } };
  });

/**
 * Persiste el conjunto completo de items del roadmap (estrategia
 * "replace-all": borra los existentes e inserta el snapshot recibido).
 *
 * Se eligió replace-all en lugar de diff incremental porque el cliente ya
 * mantiene el estado completo y lo envía con debounce (~350 ms) desde
 * `useRoadmapBoard`; así se evita reconciliar altas/bajas/reparentados.
 * IMPORTANTE: el cliente debe enviar SIEMPRE la lista normalizada
 * (`normalizeItems`) para que se guarden los invariantes de esfuerzo y quarter.
 */
export const persistItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string; items: RoadmapItem[] }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRoadmapOwned(supabase as never, data.roadmapId, userId);
    const { error: delErr } = await supabase
      .from("roadmap_items")
      .delete()
      .eq("roadmap_id", data.roadmapId);
    if (delErr) throw new Error(delErr.message);
    if (data.items.length) {
      const rows = data.items.map((it) => itemToRow(it, userId, data.roadmapId));
      const { error } = await supabase.from("roadmap_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

/**
 * Guarda la configuración de capacidad del roadmap (delete + insert: solo hay
 * una fila por roadmap, así que reemplazarla evita conflictos de upsert).
 */
export const persistCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string; capacity: CapacityConfig }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRoadmapOwned(supabase as never, data.roadmapId, userId);
    const { error: delErr } = await supabase
      .from("roadmap_capacity")
      .delete()
      .eq("roadmap_id", data.roadmapId);
    if (delErr) throw new Error(delErr.message);
    const { error } = await supabase.from("roadmap_capacity").insert({
      user_id: userId,
      roadmap_id: data.roadmapId,
      developers: data.capacity.developers,
      dedication_pct: data.capacity.dedicationPct,
      days_per_sprint: data.capacity.daysPerSprint,
      hours_per_day: data.capacity.hoursPerDay,
      sprints_per_quarter: data.capacity.sprintsPerQuarter,
      sprints_by_quarter: data.capacity.sprintsByQuarter ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Vacía por completo un roadmap (items + capacidad) sin borrar la cabecera.
 * Es la operación que respalda el botón "Reset demo data" del Backlog.
 */
export const resetRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRoadmapOwned(supabase as never, data.roadmapId, userId);
    const { error: e1 } = await supabase.from("roadmap_items").delete().eq("roadmap_id", data.roadmapId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.from("roadmap_capacity").delete().eq("roadmap_id", data.roadmapId);
    if (e2) throw new Error(e2.message);
    return { ok: true as const };
  });
