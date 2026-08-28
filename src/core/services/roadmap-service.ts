/**
 * =============================================================================
 * Servicio de Roadmaps (cabeceras)
 * =============================================================================
 * Casos de uso sobre la entidad `roadmaps`: listar, crear, renombrar, borrar,
 * cargar completo y vaciar. Todos los servicios reciben `RoadGateContext` y
 * devuelven DTOs planos (serializables), nunca filas crudas ni clientes.
 *
 * Autorización: cada operación filtra por `user_id` y, cuando toca datos
 * anidados (items/capacidad), llama antes a `assertRoadmapOwned`. Es defensa en
 * profundidad: RLS ya lo impide en BD, pero el core no depende de ello.
 */
import type { RoadGateContext } from "../context";
import { NotFoundError, unwrap } from "../errors";
import { parseInput, createRoadmapInput, renameRoadmapInput, roadmapRefInput } from "../schemas";
import { rowToCapacity, rowToItem, type CapacityRow, type ItemRow } from "../mappers";
import type { CapacityConfig, RoadmapItem } from "@/lib/roadmap";

/** Resumen de un roadmap para la pantalla de listado. */
export type RoadmapSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Número de work items que contiene (Epics + Features + User Stories). */
  itemCount: number;
};

/** Contenido completo de un roadmap: cabecera + items + capacidad. */
export type RoadmapDetail = {
  roadmap: { id: string; name: string };
  items: RoadmapItem[];
  capacity: CapacityConfig;
};

/**
 * Comprueba que el roadmap existe y pertenece al actor.
 * Se exporta porque el resto de servicios (items, capacidad) la reutilizan
 * como guarda previa a cualquier lectura o escritura anidada.
 * @throws NotFoundError si no existe o es de otra cuenta (no se distingue
 *         entre ambos casos a propósito: evita enumerar IDs ajenos).
 */
export async function assertRoadmapOwned(
  ctx: RoadGateContext,
  roadmapId: string,
): Promise<void> {
  const data = unwrap(
    await ctx.db
      .from("roadmaps")
      .select("id")
      .eq("id", roadmapId)
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    "assertRoadmapOwned",
  );
  if (!data) throw new NotFoundError("Roadmap");
}

/**
 * Lista los roadmaps del actor (más recientes primero) con el número de work
 * items de cada uno. El conteo se resuelve con UNA consulta adicional agregada
 * en memoria para evitar el problema N+1.
 */
export async function listRoadmaps(ctx: RoadGateContext): Promise<RoadmapSummary[]> {
  const rows = unwrap(
    await ctx.db
      .from("roadmaps")
      .select("id, name, created_at, updated_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false }),
    "listRoadmaps",
  );

  const ids = (rows ?? []).map((r) => r.id as string);
  let countsByRoadmap: Record<string, number> = {};
  if (ids.length) {
    const itemRows = unwrap(
      await ctx.db.from("roadmap_items").select("roadmap_id").in("roadmap_id", ids),
      "listRoadmaps.counts",
    );
    countsByRoadmap = (itemRows ?? []).reduce<Record<string, number>>((acc, r) => {
      const rid = (r as { roadmap_id: string }).roadmap_id;
      acc[rid] = (acc[rid] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    itemCount: countsByRoadmap[r.id as string] ?? 0,
  }));
}

/**
 * Crea un roadmap vacío (sin items ni capacidad) y devuelve su id para navegar.
 * Si no llega nombre se aplica un título por defecto en lugar de fallar: crear
 * un roadmap es una acción de un clic y no debe bloquearse por un campo vacío.
 */
export async function createRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ id: string }> {
  const { name } = parseInput(createRoadmapInput, input);
  const finalName = (name ?? "").trim() || "Hoja de ruta sin título";
  // Fase I: todo roadmap nace dentro de la cuenta de equipo del actor, que se
  // provisiona de forma idempotente si aún no existía.
  const team = await ensureActiveTeam(ctx);
  const row = unwrap(
    await ctx.db
      .from("roadmaps")
      .insert({
        user_id: ctx.userId,
        name: finalName,
        team_id: team.id,
        admin_member_id: team.memberId,
      })
      .select("id")
      .single(),
    "createRoadmap",
  );
  return { id: (row as { id: string }).id };
}


/** Renombra un roadmap del actor. El nombre vacío se rechaza en el esquema. */
export async function renameRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId, name } = parseInput(renameRoadmapInput, input);
  await assertRoadmapOwned(ctx, roadmapId);
  unwrap(
    await ctx.db
      .from("roadmaps")
      .update({ name })
      .eq("id", roadmapId)
      .eq("user_id", ctx.userId),
    "renameRoadmap",
  );
  return { ok: true };
}

/**
 * Borra un roadmap del actor. Los items, la capacidad y el histórico se
 * eliminan por `ON DELETE CASCADE` en el esquema.
 */
export async function deleteRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await assertRoadmapOwned(ctx, roadmapId);
  unwrap(
    await ctx.db.from("roadmaps").delete().eq("id", roadmapId).eq("user_id", ctx.userId),
    "deleteRoadmap",
  );
  return { ok: true };
}

/**
 * Carga completa de un roadmap (cabecera + items + capacidad) en paralelo.
 * Es la operación que alimenta toda la pantalla de trabajo, por eso devuelve
 * todo de una vez en lugar de obligar al cliente a encadenar tres llamadas.
 */
export async function getRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<RoadmapDetail> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await assertRoadmapOwned(ctx, roadmapId);

  const [itemsRes, capRes, rmRes] = await Promise.all([
    ctx.db.from("roadmap_items").select("*").eq("roadmap_id", roadmapId),
    ctx.db.from("roadmap_capacity").select("*").eq("roadmap_id", roadmapId).maybeSingle(),
    ctx.db.from("roadmaps").select("id, name").eq("id", roadmapId).single(),
  ]);

  const itemRows = unwrap(itemsRes, "getRoadmap.items") as unknown as ItemRow[];
  const capRow = unwrap(capRes, "getRoadmap.capacity") as unknown as CapacityRow | null;
  const rm = unwrap(rmRes, "getRoadmap.header") as { id: string; name: string };

  return {
    roadmap: { id: rm.id, name: rm.name },
    items: (itemRows ?? []).map(rowToItem),
    capacity: rowToCapacity(capRow),
  };
}

/**
 * Vacía por completo un roadmap (items + capacidad) conservando la cabecera.
 * Respalda el botón "Reset" del Backlog: el usuario quiere empezar de cero sin
 * perder la URL ni el nombre del roadmap.
 */
export async function resetRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await assertRoadmapOwned(ctx, roadmapId);
  unwrap(
    await ctx.db.from("roadmap_items").delete().eq("roadmap_id", roadmapId),
    "resetRoadmap.items",
  );
  unwrap(
    await ctx.db.from("roadmap_capacity").delete().eq("roadmap_id", roadmapId),
    "resetRoadmap.capacity",
  );
  return { ok: true };
}
