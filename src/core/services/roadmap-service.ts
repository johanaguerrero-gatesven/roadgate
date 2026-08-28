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
import { ensureActiveTeam } from "./team-service";
import {
  getRoadmapRole,
  listAccessibleRoadmapIds,
  requireRoadmapAccess,
  type RoadmapRole,
} from "./sharing-service";
import type { CapacityConfig, RoadmapItem } from "@/lib/roadmap";

/** Resumen de un roadmap para la pantalla de listado. */
export type RoadmapSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Número de work items que contiene (Epics + Features + User Stories). */
  itemCount: number;
  /** Permiso del actor sobre este roadmap. */
  role: RoadmapRole;
  /** `true` cuando llega por colaboración y no por propiedad. */
  shared: boolean;
};

/** Contenido completo de un roadmap: cabecera + items + capacidad. */
export type RoadmapDetail = {
  roadmap: { id: string; name: string };
  items: RoadmapItem[];
  capacity: CapacityConfig;
  /** Permiso del actor: el frontend lo usa para pintar en modo solo lectura. */
  role: RoadmapRole;
};

/**
 * Guarda de acceso reutilizada por los servicios hijos (items, capacidad).
 * Desde la Fase III el criterio ya no es "ser el dueño" sino tener permiso de
 * ESCRITURA (Admin o Editor) sobre el roadmap.
 * @throws NotFoundError si el actor no puede ni leerlo (evita enumerar ids).
 * @throws ForbiddenError si es Viewer.
 */
export async function assertRoadmapOwned(
  ctx: RoadGateContext,
  roadmapId: string,
): Promise<void> {
  await requireRoadmapAccess(ctx, roadmapId, "write");
}

/** Guarda de solo lectura (Admin, Editor o Viewer). */
export async function assertRoadmapReadable(
  ctx: RoadGateContext,
  roadmapId: string,
): Promise<RoadmapRole> {
  return requireRoadmapAccess(ctx, roadmapId, "read");
}

/**
 * Lista los roadmaps accesibles por el actor (propios + compartidos con él),
 * más recientes primero, con el número de work items de cada uno. El conteo se
 * resuelve con UNA consulta adicional agregada en memoria (evita el N+1).
 */
export async function listRoadmaps(ctx: RoadGateContext): Promise<RoadmapSummary[]> {
  const { owned, shared } = await listAccessibleRoadmapIds(ctx);
  const all = [...owned, ...shared];
  if (!all.length) return [];

  const rows = unwrap(
    await ctx.db
      .from("roadmaps")
      .select("id, name, created_at, updated_at")
      .in("id", all)
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

  const summaries = await Promise.all(
    (rows ?? []).map(async (r) => {
      const id = r.id as string;
      const isShared = !owned.includes(id);
      const role = isShared ? ((await getRoadmapRole(ctx, id)) ?? "viewer") : "admin";
      return {
        id,
        name: r.name as string,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        itemCount: countsByRoadmap[id] ?? 0,
        role: role as RoadmapRole,
        shared: isShared,
      };
    }),
  );
  return summaries;
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


/** Renombra un roadmap. Requiere permiso de escritura (Admin o Editor). */
export async function renameRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId, name } = parseInput(renameRoadmapInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "write");
  unwrap(
    await ctx.db.from("roadmaps").update({ name }).eq("id", roadmapId),
    "renameRoadmap",
  );
  return { ok: true };
}

/**
 * Borra un roadmap. SOLO el Roadmap Admin. Los items, la capacidad y el
 * histórico se eliminan por `ON DELETE CASCADE` en el esquema.
 */
export async function deleteRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "admin");
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
 * Accesible para Admin, Editor y Viewer; el rol viaja en la respuesta.
 */
export async function getRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<RoadmapDetail> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  const role = await requireRoadmapAccess(ctx, roadmapId, "read");

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
    role,
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
