/**
 * =============================================================================
 * Servicio de Equipos (Fase I — cuenta de equipo única por usuario)
 * =============================================================================
 * Modelo simple: cada usuario pertenece a UNA cuenta de equipo. El creador es
 * Team Admin. No hay organizaciones múltiples ni grupos internos.
 *
 * La creación del equipo es idempotente y vive en la función SQL
 * `public.ensure_personal_team()` (SECURITY DEFINER, ligada a `auth.uid()`):
 * así el alta funciona igual venga del RPC interno o de la API REST, y nunca
 * depende del cliente.
 */
import type { RoadGateContext } from "../context";
import { unwrap } from "../errors";

/** Equipo activo del actor junto a su rol dentro de él. */
export type ActiveTeam = {
  id: string;
  name: string;
  status: string;
  plan: string;
  seatLimit: number;
  /** Rol del actor en este equipo. */
  role: "admin" | "member";
  /** Id de su fila en `team_members` (usado como `admin_member_id`). */
  memberId: string;
};

/**
 * Devuelve la membresía activa del actor, creando equipo + membresía Admin la
 * primera vez (operación idempotente en BD).
 */
export async function ensureActiveTeam(ctx: RoadGateContext): Promise<ActiveTeam> {
  const membership = await readMembership(ctx);
  if (membership) return membership;

  // No hay membresía: la función SQL la crea de forma atómica e idempotente.
  const { error } = await ctx.db.rpc("ensure_personal_team");
  if (error) throw new Error(`ensureActiveTeam: ${error.message}`);

  const created = await readMembership(ctx);
  if (!created) throw new Error("ensureActiveTeam: team could not be provisioned");
  return created;
}

/** Lee la membresía activa (Admin primero) sin crear nada. */
async function readMembership(ctx: RoadGateContext): Promise<ActiveTeam | null> {
  const rows = unwrap(
    await ctx.db
      .from("team_members")
      .select("id, role, team_id, created_at, teams(id, name, status, plan, seat_limit)")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    "readMembership",
  ) as unknown as Array<{
    id: string;
    role: "admin" | "member";
    team_id: string;
    teams: { id: string; name: string; status: string; plan: string; seat_limit: number } | null;
  }> | null;

  const list = rows ?? [];
  const row = list.find((r) => r.role === "admin") ?? list[0];
  if (!row || !row.teams) return null;

  return {
    id: row.teams.id,
    name: row.teams.name,
    status: row.teams.status,
    plan: row.teams.plan,
    seatLimit: row.teams.seat_limit,
    role: row.role,
    memberId: row.id,
  };
}

/** Equipo activo del actor (sin provisionar si no existe). */
export async function getActiveTeam(ctx: RoadGateContext): Promise<ActiveTeam | null> {
  return readMembership(ctx);
}
