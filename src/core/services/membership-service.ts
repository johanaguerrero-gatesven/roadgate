/**
 * =============================================================================
 * Caso de uso: miembros e invitaciones de equipo (Fase II)
 * =============================================================================
 * Modelo de cuenta: un equipo con un Team Admin (quien lo creó) y N Team
 * Members. No hay más roles de cuenta.
 *
 * Diseño de seguridad:
 *  - Toda operación de administración verifica el rol EN BASE DE DATOS (la
 *    membresía activa del actor) y además está protegida por RLS
 *    (`is_team_admin`). Nunca depende del cliente ni de localStorage.
 *  - El token de invitación se genera aquí, se devuelve UNA sola vez al
 *    adaptador (para enviarlo por email) y en BD sólo se guarda su SHA-256.
 *  - La aceptación se delega en la función SQL `accept_team_invitation`
 *    (SECURITY DEFINER, idempotente), que valida caducidad, revocación, uso
 *    previo y coincidencia de email, y siempre da de alta como `member`.
 */
import { z } from "zod";
import type { RoadGateContext } from "../context";
import { unwrap, ForbiddenError, NotFoundError, ConflictError, ValidationError } from "../errors";
import { parseInput, uuidSchema } from "../schemas";
import { getActiveTeam, type ActiveTeam } from "./team-service";

/** Días de validez de una invitación. */
export const INVITATION_TTL_DAYS = 7;

export type TeamMemberView = {
  id: string;
  userId: string;
  email: string | null;
  role: "admin" | "member";
  status: "active" | "inactive";
  createdAt: string;
};

export type TeamInvitationView = {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** Estado derivado, listo para pintar en la UI. */
  status: "pending" | "expired" | "accepted" | "revoked";
};

export const inviteMemberInput = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required").max(254),
});
export const invitationIdInput = z.object({ invitationId: uuidSchema });
export const setMemberStatusInput = z.object({
  memberId: uuidSchema,
  status: z.enum(["active", "inactive"]),
});
export const acceptInvitationInput = z.object({ token: z.string().trim().min(20).max(200) });

// --- Utilidades --------------------------------------------------------------

/** SHA-256 hexadecimal (Web Crypto: válido en el runtime serverless y en Node). */
export async function hashInvitationToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Equipo del actor exigiendo rol Admin. La comprobación es de servidor. */
async function requireAdminTeam(ctx: RoadGateContext): Promise<ActiveTeam> {
  const team = await getActiveTeam(ctx);
  if (!team) throw new NotFoundError("Team");
  if (team.role !== "admin") throw new ForbiddenError("Only the team admin can manage members");
  return team;
}

async function requireTeam(ctx: RoadGateContext): Promise<ActiveTeam> {
  const team = await getActiveTeam(ctx);
  if (!team) throw new NotFoundError("Team");
  return team;
}

function toInvitationView(row: {
  id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}): TeamInvitationView {
  const status: TeamInvitationView["status"] = row.accepted_at
    ? "accepted"
    : row.revoked_at
      ? "revoked"
      : new Date(row.expires_at).getTime() < Date.now()
        ? "expired"
        : "pending";
  return {
    id: row.id,
    email: row.email,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    status,
  };
}

// --- Lectura -----------------------------------------------------------------

/** Miembros del equipo activo (cualquier miembro puede verlos). */
export async function listTeamMembers(ctx: RoadGateContext): Promise<TeamMemberView[]> {
  const team = await requireTeam(ctx);
  const rows = unwrap(
    await ctx.db
      .from("team_members")
      .select("id,user_id,email,role,status,created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: true }),
    "listTeamMembers",
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email ?? null,
    role: r.role === "admin" ? "admin" : "member",
    status: r.status === "inactive" ? "inactive" : "active",
    createdAt: r.created_at,
  }));
}

/** Invitaciones del equipo activo. Sólo Admin (RLS lo refuerza). */
export async function listTeamInvitations(ctx: RoadGateContext): Promise<TeamInvitationView[]> {
  const team = await requireAdminTeam(ctx);
  const rows = unwrap(
    await ctx.db
      .from("team_invitations")
      .select("id,email,expires_at,accepted_at,revoked_at,created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    "listTeamInvitations",
  );
  return (rows ?? []).map(toInvitationView);
}

// --- Invitaciones ------------------------------------------------------------

export type IssuedInvitation = {
  invitation: TeamInvitationView;
  /** Token en claro: sólo para construir el enlace del email. No persistirlo. */
  token: string;
};

/** Crea una invitación como Team Member. Rechaza duplicados y miembros ya activos. */
export async function inviteMember(
  ctx: RoadGateContext,
  input: unknown,
): Promise<IssuedInvitation> {
  const { email } = parseInput(inviteMemberInput, input);
  const team = await requireAdminTeam(ctx);

  const existingMember = unwrap(
    await ctx.db
      .from("team_members")
      .select("id,status")
      .eq("team_id", team.id)
      .eq("email", email)
      .maybeSingle(),
    "inviteMember:member",
  );
  if (existingMember) {
    throw new ConflictError(
      existingMember.status === "active"
        ? "This email already belongs to the team"
        : "This email belongs to a deactivated member: reactivate it instead",
    );
  }

  const pending = unwrap(
    await ctx.db
      .from("team_invitations")
      .select("id")
      .eq("team_id", team.id)
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle(),
    "inviteMember:pending",
  );
  if (pending) throw new ConflictError("There is already a pending invitation for this email");

  const token = generateToken();
  const row = unwrap(
    await ctx.db
      .from("team_invitations")
      .insert({
        team_id: team.id,
        email,
        token_hash: await hashInvitationToken(token),
        expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString(),
        invited_by: ctx.userId,
      })
      .select("id,email,expires_at,accepted_at,revoked_at,created_at")
      .single(),
    "inviteMember:insert",
  );
  if (!row) throw new ValidationError("Could not create the invitation");

  return { invitation: toInvitationView(row), token };
}

/** Reenvía: rota el token y renueva la caducidad (el token anterior deja de valer). */
export async function resendInvitation(
  ctx: RoadGateContext,
  input: unknown,
): Promise<IssuedInvitation> {
  const { invitationId } = parseInput(invitationIdInput, input);
  const team = await requireAdminTeam(ctx);

  const current = unwrap(
    await ctx.db
      .from("team_invitations")
      .select("id,accepted_at,revoked_at")
      .eq("id", invitationId)
      .eq("team_id", team.id)
      .maybeSingle(),
    "resendInvitation:read",
  );
  if (!current) throw new NotFoundError("Invitation");
  if (current.accepted_at) throw new ConflictError("This invitation was already accepted");
  if (current.revoked_at) throw new ConflictError("This invitation was revoked");

  const token = generateToken();
  const row = unwrap(
    await ctx.db
      .from("team_invitations")
      .update({
        token_hash: await hashInvitationToken(token),
        expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString(),
      })
      .eq("id", invitationId)
      .eq("team_id", team.id)
      .select("id,email,expires_at,accepted_at,revoked_at,created_at")
      .single(),
    "resendInvitation:update",
  );
  if (!row) throw new NotFoundError("Invitation");
  return { invitation: toInvitationView(row), token };
}

/** Revoca una invitación pendiente: su token deja de ser válido de inmediato. */
export async function revokeInvitation(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { invitationId } = parseInput(invitationIdInput, input);
  const team = await requireAdminTeam(ctx);

  const row = unwrap(
    await ctx.db
      .from("team_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("team_id", team.id)
      .is("accepted_at", null)
      .select("id")
      .maybeSingle(),
    "revokeInvitation",
  );
  if (!row) throw new NotFoundError("Invitation");
  return { ok: true };
}

// --- Miembros ----------------------------------------------------------------

/** Roadmap que administra una persona y que bloquea su desactivación. */
export type AdministeredRoadmap = { id: string; name: string };

/**
 * Roadmaps del equipo cuyo Admin es ese miembro. Solo Team Admin.
 * Es la lista que hay que relevar ANTES de desactivar a la persona.
 */
export async function listMemberAdminRoadmaps(
  ctx: RoadGateContext,
  input: unknown,
): Promise<AdministeredRoadmap[]> {
  const { memberId } = parseInput(z.object({ memberId: uuidSchema }), input);
  const team = await requireAdminTeam(ctx);

  const member = unwrap(
    await ctx.db
      .from("team_members")
      .select("id,user_id")
      .eq("id", memberId)
      .eq("team_id", team.id)
      .maybeSingle(),
    "listMemberAdminRoadmaps:member",
  );
  if (!member) throw new NotFoundError("Team member");

  const rows = unwrap(
    await ctx.db
      .from("roadmaps")
      .select("id,name")
      .eq("team_id", team.id)
      .eq("user_id", member.user_id)
      .order("name", { ascending: true }),
    "listMemberAdminRoadmaps:roadmaps",
  ) as unknown as Array<{ id: string; name: string }> | null;

  return (rows ?? []).map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Activa o desactiva un miembro (Fase 4).
 *
 * Reglas de offboarding:
 *  - No puedes cambiar tu propio estado.
 *  - No se puede desactivar al ÚLTIMO Team Admin activo.
 *  - Si la persona administra roadmaps, hay que transferir esa administración
 *    antes: se rechaza con la lista de roadmaps pendientes.
 *  - Desactivar retira el acceso al instante (RLS exige membresía activa,
 *    también para los roadmaps propios) pero NO borra roadmaps, items,
 *    capacidad, historial ni sus accesos compartidos.
 *  - Reactivar devuelve la membresía y los accesos compartidos conservados;
 *    NO devuelve la administración de roadmaps transferida a otra persona.
 */
export async function setMemberStatus(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { memberId, status } = parseInput(setMemberStatusInput, input);
  const team = await requireAdminTeam(ctx);

  const member = unwrap(
    await ctx.db
      .from("team_members")
      .select("id,user_id,role,status,email")
      .eq("id", memberId)
      .eq("team_id", team.id)
      .maybeSingle(),
    "setMemberStatus:read",
  );
  if (!member) throw new NotFoundError("Team member");
  if (member.user_id === ctx.userId) {
    throw new ForbiddenError("You cannot change your own membership status");
  }

  if (status === "inactive") {
    if (member.role === "admin") {
      const admins = unwrap(
        await ctx.db
          .from("team_members")
          .select("id")
          .eq("team_id", team.id)
          .eq("role", "admin")
          .eq("status", "active"),
        "setMemberStatus:admins",
      ) as unknown as Array<{ id: string }> | null;
      if ((admins ?? []).length <= 1) {
        throw new ForbiddenError("The last team admin cannot be deactivated");
      }
    }

    const administered = await listMemberAdminRoadmaps(ctx, { memberId });
    if (administered.length > 0) {
      throw new ConflictError(
        `Transfer roadmap administration first: ${administered.map((r) => r.name).join(", ")}`,
      );
    }
  }

  if (member.status === status) return { ok: true };

  unwrap(
    await ctx.db
      .from("team_members")
      .update({ status })
      .eq("id", memberId)
      .eq("team_id", team.id)
      .select("id"),
    "setMemberStatus:update",
  );

  await recordAuditEvent(ctx, {
    teamId: team.id,
    action: "member.status_changed",
    targetEmail: member.email ?? null,
    targetUserId: member.user_id,
    metadata: { from: member.status, to: status },
  });

  return { ok: true };
}


// --- Aceptación --------------------------------------------------------------

/**
 * Acepta una invitación con el token en claro. Idempotente: repetir la llamada
 * con una invitación ya aceptada por el mismo usuario devuelve el mismo equipo.
 */
export async function acceptInvitation(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ teamId: string }> {
  const { token } = parseInput(acceptInvitationInput, input);
  const tokenHash = await hashInvitationToken(token);

  const { data, error } = await ctx.db.rpc("accept_team_invitation", { _token_hash: tokenHash });
  if (error) {
    const message = error.message || "";
    if (message.includes("invitation_not_found")) throw new NotFoundError("Invitation");
    if (message.includes("invitation_revoked")) throw new ForbiddenError("This invitation was revoked");
    if (message.includes("invitation_expired")) throw new ForbiddenError("This invitation has expired");
    if (message.includes("invitation_already_used"))
      throw new ConflictError("This invitation was already used");
    if (message.includes("invitation_email_mismatch"))
      throw new ForbiddenError("This invitation was sent to a different email address");
    throw new ForbiddenError("The invitation could not be accepted");
  }
  return { teamId: data as unknown as string };
}
