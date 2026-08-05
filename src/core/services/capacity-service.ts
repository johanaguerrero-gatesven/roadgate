/**
 * =============================================================================
 * Servicio de Capacidad
 * =============================================================================
 * Casos de uso sobre `roadmap_capacity` (1 fila por roadmap) y su audit trail
 * en `roadmap_capacity_history`.
 *
 * Dos decisiones de diseño a tener en cuenta:
 *  1. Se guarda con DELETE + INSERT en lugar de UPSERT: al existir como mucho
 *     una fila por roadmap, reemplazarla evita conflictos de clave y deja el
 *     estado siempre consistente.
 *  2. El histórico se calcula "aplanando" la configuración anterior y la nueva
 *     a pares campo→valor y registrando SOLO los campos que cambian de verdad,
 *     de modo que el audit trail no se llene de ruido.
 */
import type { RoadGateContext } from "../context";
import { unwrap } from "../errors";
import { parseInput, roadmapRefInput, saveCapacityInput } from "../schemas";
import { capacityToRow, rowToCapacity, type CapacityRow } from "../mappers";
import { assertRoadmapOwned } from "./roadmap-service";
import type { CapacityConfig } from "@/lib/roadmap";

/** Un apunte del histórico de capacidad, ya adaptado a la vista. */
export type CapacityHistoryEntry = {
  id: string;
  /** Campo modificado, en notación plana (p. ej. `hoursByQuarter.Q3`). */
  field: string;
  oldValue: string | null;
  newValue: string | null;
  /** Email de quien hizo el cambio (puede faltar en datos antiguos). */
  by: string;
  /** Timestamp ISO del cambio. */
  at: string;
};

/**
 * Aplana la configuración a pares campo→valor en texto.
 * Trabajar con strings simplifica la comparación "antes vs después" y encaja
 * con las columnas `old_value`/`new_value` del histórico, que son textuales.
 */
function flattenCapacity(c: CapacityConfig): Record<string, string> {
  const flat: Record<string, string> = {
    developers: String(c.developers ?? 0),
    dedicationPct: String(c.dedicationPct ?? 0),
    daysPerSprint: String(c.daysPerSprint ?? 0),
    hoursPerDay: String(c.hoursPerDay ?? 0),
    sprintsPerQuarter: String(c.sprintsPerQuarter ?? 0),
  };
  const byQ = (c.sprintsByQuarter ?? {}) as Record<string, number>;
  Object.keys(byQ).forEach((q) => {
    flat[`sprintsByQuarter.${q}`] = String(byQ[q] ?? "");
  });
  const hByQ = (c.hoursByQuarter ?? {}) as Record<string, number>;
  Object.keys(hByQ).forEach((q) => {
    flat[`hoursByQuarter.${q}`] = String(hByQ[q] ?? "");
  });
  return flat;
}

/**
 * Devuelve la capacidad del roadmap. Si aún no se ha configurado se devuelve
 * `defaultCapacity` (vía `rowToCapacity`) en lugar de `null`, para que el
 * consumidor siempre tenga números con los que calcular utilización.
 */
export async function getCapacity(
  ctx: RoadGateContext,
  input: unknown,
): Promise<CapacityConfig> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await assertRoadmapOwned(ctx, roadmapId);
  const row = unwrap(
    await ctx.db.from("roadmap_capacity").select("*").eq("roadmap_id", roadmapId).maybeSingle(),
    "getCapacity",
  ) as unknown as CapacityRow | null;
  return rowToCapacity(row);
}

/**
 * Guarda la capacidad del roadmap y registra en el audit trail un apunte por
 * cada campo cuyo valor haya cambiado.
 * @returns `logged` = número de apuntes escritos (0 si no hubo cambios reales).
 */
export async function saveCapacity(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true; logged: number }> {
  const { roadmapId, capacity } = parseInput(saveCapacityInput, input);
  await assertRoadmapOwned(ctx, roadmapId);

  // 1) Estado anterior, para poder comparar antes de sobrescribir.
  const prevRow = unwrap(
    await ctx.db.from("roadmap_capacity").select("*").eq("roadmap_id", roadmapId).maybeSingle(),
    "saveCapacity.previous",
  ) as unknown as CapacityRow | null;
  const before = prevRow ? flattenCapacity(rowToCapacity(prevRow)) : null;
  const after = flattenCapacity(capacity as CapacityConfig);

  // 2) Reemplazo de la única fila de capacidad.
  unwrap(
    await ctx.db.from("roadmap_capacity").delete().eq("roadmap_id", roadmapId),
    "saveCapacity.delete",
  );
  unwrap(
    await ctx.db
      .from("roadmap_capacity")
      .insert(capacityToRow(capacity as CapacityConfig, ctx.userId, roadmapId)),
    "saveCapacity.insert",
  );

  // 3) Audit trail: sólo diferencias reales.
  const fields = new Set([...Object.keys(after), ...Object.keys(before ?? {})]);
  const entries = [...fields]
    .filter((f) => (before?.[f] ?? null) !== (after[f] ?? null))
    .map((f) => ({
      roadmap_id: roadmapId,
      user_id: ctx.userId,
      changed_by_email: ctx.email ?? null,
      field: f,
      old_value: before ? (before[f] ?? null) : null,
      new_value: after[f] ?? null,
    }));

  if (entries.length) {
    // El histórico es informativo: si falla, se registra pero NO se aborta el
    // guardado de la capacidad, que es la operación que el usuario pidió.
    const { error } = await ctx.db.from("roadmap_capacity_history").insert(entries);
    if (error) console.error("capacity history:", error.message);
  }

  return { ok: true, logged: entries.length };
}

/**
 * Histórico de cambios de capacidad (más recientes primero).
 * Se limita a 200 apuntes para acotar la respuesta; la paginación completa se
 * añadirá cuando la API REST lo requiera.
 */
export async function listCapacityHistory(
  ctx: RoadGateContext,
  input: unknown,
): Promise<CapacityHistoryEntry[]> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await assertRoadmapOwned(ctx, roadmapId);
  const rows = unwrap(
    await ctx.db
      .from("roadmap_capacity_history")
      .select("id, field, old_value, new_value, changed_by_email, created_at")
      .eq("roadmap_id", roadmapId)
      .order("created_at", { ascending: false })
      .limit(200),
    "listCapacityHistory",
  );
  return (rows ?? []).map((r) => ({
    id: r.id as string,
    field: r.field as string,
    oldValue: (r.old_value ?? null) as string | null,
    newValue: (r.new_value ?? null) as string | null,
    by: (r.changed_by_email ?? "") as string,
    at: r.created_at as string,
  }));
}
