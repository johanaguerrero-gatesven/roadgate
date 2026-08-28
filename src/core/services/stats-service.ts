/**
 * =============================================================================
 * Servicio de Estadísticas del workspace
 * =============================================================================
 * Alimenta las tarjetas de métricas de la portada del usuario.
 *
 * Semántica de los números (importante para no mezclar ámbitos):
 *  - `roadmapsCount`   → roadmaps activos del actor (métrica de espacio).
 *  - `totalItems`      → work items del roadmap SELECCIONADO, o de todos si no
 *                        se indica ninguno. Nunca mezcla ámbitos distintos.
 *  - `byType`          → desglose de esos mismos items por Epic/Feature/Story.
 *  - `teamsCount` /
 *    `totalDevelopers` → configuraciones de capacidad existentes y suma de FTE.
 *                        La capacidad se gestiona por roadmap; a nivel global
 *                        estos valores son sólo informativos.
 */
import type { RoadGateContext } from "../context";
import { unwrap } from "../errors";
import { parseInput, workspaceStatsInput } from "../schemas";
import { listAccessibleRoadmapIds } from "./sharing-service";

/** DTO de métricas del workspace. */
export type WorkspaceStats = {
  roadmapsCount: number;
  teamsCount: number;
  totalDevelopers: number;
  totalItems: number;
  byType: { epic: number; feature: number; story: number };
};

/**
 * Calcula las métricas del workspace, opcionalmente acotadas a un roadmap.
 * @param input `{ roadmapId?: string | null }` — si el id no pertenece al
 *        actor simplemente se ignora y se agregan todos sus roadmaps (no se
 *        lanza error: es un filtro de visualización, no un acceso a recurso).
 */
export async function getWorkspaceStats(
  ctx: RoadGateContext,
  input?: unknown,
): Promise<WorkspaceStats> {
  const { roadmapId } = parseInput(workspaceStatsInput, input ?? {});

  // Fase III: el ámbito son los roadmaps que el actor puede LEER (propios y
  // compartidos con él); nunca los de otros equipos.
  const accessible = await listAccessibleRoadmapIds(ctx);
  const [rmRes, capRes] = await Promise.all([
    ctx.db.from("roadmaps").select("id").in("id", [...accessible.owned, ...accessible.shared]),
    ctx.db
      .from("roadmap_capacity")
      .select("roadmap_id, developers, dedication_pct")
      .eq("user_id", ctx.userId),
  ]);
  const roadmapRows = unwrap(rmRes, "getWorkspaceStats.roadmaps");
  const capRows = unwrap(capRes, "getWorkspaceStats.capacity") as Array<{
    roadmap_id: string;
    developers: number;
  }>;

  const allIds = (roadmapRows ?? []).map((r) => (r as { id: string }).id);
  const selectedId = roadmapId ?? null;
  const scopedIds = selectedId && allIds.includes(selectedId) ? [selectedId] : allIds;

  let totalItems = 0;
  const byType = { epic: 0, feature: 0, story: 0 };
  if (scopedIds.length > 0) {
    const itemRows = unwrap(
      await ctx.db.from("roadmap_items").select("id, type").in("roadmap_id", scopedIds),
      "getWorkspaceStats.items",
    ) as Array<{ type: string | null }>;
    totalItems = (itemRows ?? []).length;
    for (const r of itemRows ?? []) {
      if (r.type === "epic" || r.type === "feature" || r.type === "story") byType[r.type] += 1;
    }
  }

  return {
    roadmapsCount: allIds.length,
    teamsCount: (capRows ?? []).length,
    totalDevelopers: (capRows ?? []).reduce((acc, c) => acc + Number(c.developers ?? 0), 0),
    totalItems,
    byType,
  };
}
