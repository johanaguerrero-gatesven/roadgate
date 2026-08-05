/**
 * =============================================================================
 * Servicio de Work Items
 * =============================================================================
 * Casos de uso sobre `roadmap_items` (Epics, Features y User Stories).
 *
 * Estrategia de escritura: REPLACE-ALL.
 * `replaceItems` borra los items del roadmap e inserta el snapshot recibido.
 * Se eligió frente a un diff incremental porque el cliente ya mantiene el
 * estado completo en memoria y lo envía con debounce (~350 ms): así no hay que
 * reconciliar altas, bajas ni reparentados, y el resultado es idempotente.
 *
 * IMPORTANTE para cualquier consumidor (frontend o API externa): el snapshot
 * debe venir ya normalizado (`normalizeItems` de `@/lib/roadmap`) para que se
 * respeten los invariantes de esfuerzo agregado y Quarter derivado del padre.
 */
import type { RoadGateContext } from "../context";
import { unwrap } from "../errors";
import { parseInput, replaceItemsInput, roadmapRefInput } from "../schemas";
import { itemToRow, rowToItem, type ItemRow } from "../mappers";
import { assertRoadmapOwned } from "./roadmap-service";
import type { RoadmapItem } from "@/lib/roadmap";

/** Devuelve todos los work items de un roadmap del actor. */
export async function listItems(
  ctx: RoadGateContext,
  input: unknown,
): Promise<RoadmapItem[]> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await assertRoadmapOwned(ctx, roadmapId);
  const rows = unwrap(
    await ctx.db.from("roadmap_items").select("*").eq("roadmap_id", roadmapId),
    "listItems",
  ) as unknown as ItemRow[];
  return (rows ?? []).map(rowToItem);
}

/**
 * Sustituye el conjunto completo de work items del roadmap.
 * @returns el número de items persistidos, útil para que la API REST devuelva
 *          un resumen sin tener que releer la tabla.
 */
export async function replaceItems(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true; count: number }> {
  const { roadmapId, items } = parseInput(replaceItemsInput, input);
  await assertRoadmapOwned(ctx, roadmapId);

  unwrap(
    await ctx.db.from("roadmap_items").delete().eq("roadmap_id", roadmapId),
    "replaceItems.delete",
  );

  if (items.length) {
    const rows = items.map((it) => itemToRow(it as RoadmapItem, ctx.userId, roadmapId));
    unwrap(await ctx.db.from("roadmap_items").insert(rows), "replaceItems.insert");
  }

  return { ok: true, count: items.length };
}
