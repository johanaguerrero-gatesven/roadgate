/**
 * =============================================================================
 * Servicio de Auditoría administrativa (Fase 4)
 * =============================================================================
 * Registro MÍNIMO y deliberadamente cerrado: solo seis acciones de gobierno de
 * la cuenta. No es auditoría empresarial ni traza de edición de contenido.
 *
 *   invitation.sent            → se invitó (o reenvió) a un email
 *   invitation.accepted        → alguien aceptó una invitación
 *   member.status_changed      → un miembro pasó a activo/inactivo
 *   roadmap.role_changed       → se concedió o cambió Editor/Viewer
 *   roadmap.access_revoked     → se retiró el acceso a un roadmap
 *   roadmap.admin_transferred  → cambió el Admin de un roadmap
 *
 * Seguridad:
 *  - La tabla es INMUTABLE (sin políticas de UPDATE/DELETE).
 *  - Solo Team Admin puede LEER (RLS `is_team_admin`) y aquí se vuelve a
 *    comprobar en backend. Los eventos siempre están acotados por `team_id`.
 *  - Escribir un evento nunca puede tumbar la operación de negocio: si el
 *    insert falla, se traga el error (el efecto principal ya se aplicó).
 */
import type { RoadGateContext } from "../context";
import { unwrap, ForbiddenError, NotFoundError } from "../errors";
import { getActiveTeam } from "./team-service";

export type AuditAction =
  | "invitation.sent"
  | "invitation.accepted"
  | "member.status_changed"
  | "roadmap.role_changed"
  | "roadmap.access_revoked"
  | "roadmap.admin_transferred";

export type AuditEventView = {
  id: string;
  action: AuditAction;
  actorUserId: string;
  actorEmail: string | null;
  targetEmail: string | null;
  targetUserId: string | null;
  roadmapId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RecordAuditInput = {
  teamId: string;
  action: AuditAction;
  targetEmail?: string | null;
  targetUserId?: string | null;
  roadmapId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Deja constancia de una acción administrativa. Nunca lanza. */
export async function recordAuditEvent(
  ctx: RoadGateContext,
  input: RecordAuditInput,
): Promise<void> {
  try {
    await ctx.db.from("audit_events").insert({
      team_id: input.teamId,
      actor_user_id: ctx.userId,
      actor_email: ctx.email,
      action: input.action,
      target_email: input.targetEmail ?? null,
      target_user_id: input.targetUserId ?? null,
      roadmap_id: input.roadmapId ?? null,
      metadata: (input.metadata ?? {}) as never,
    });
  } catch {
    // La auditoría no bloquea la operación principal.
  }
}

/** Actividad administrativa del equipo activo. SOLO Team Admin. */
export async function listAuditEvents(
  ctx: RoadGateContext,
  input?: { limit?: number },
): Promise<AuditEventView[]> {
  const team = await getActiveTeam(ctx);
  if (!team) throw new NotFoundError("Team");
  if (team.role !== "admin") {
    throw new ForbiddenError("Only the team admin can read administrative activity");
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
  const rows = unwrap(
    await ctx.db
      .from("audit_events")
      .select(
        "id, action, actor_user_id, actor_email, target_email, target_user_id, roadmap_id, metadata, created_at",
      )
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "listAuditEvents",
  ) as unknown as Array<{
    id: string;
    action: AuditAction;
    actor_user_id: string;
    actor_email: string | null;
    target_email: string | null;
    target_user_id: string | null;
    roadmap_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }> | null;

  return (rows ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    targetEmail: r.target_email,
    targetUserId: r.target_user_id,
    roadmapId: r.roadmap_id,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  }));
}
