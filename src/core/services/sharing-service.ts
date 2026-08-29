/**
 * =============================================================================
 * Servicio de Colaboración por roadmap (Fase III)
 * =============================================================================
 * Cada roadmap es un workspace con TRES permisos:
 *
 *   admin  → el creador (o quien recibe la transferencia). Único por roadmap:
 *            se materializa en `roadmaps.user_id` + `roadmaps.admin_member_id`.
 *            Puede editar, compartir, cambiar roles, transferir y eliminar.
 *   editor → fila en `roadmap_members` con role='editor'. Edita contenido
 *            (Backlog, Roadmap, Capacity, items) pero NO administra accesos.
 *   viewer → fila en `roadmap_members` con role='viewer'. Solo lectura.
 *
 * Reglas duras:
 *  - Solo se comparte con miembros ACTIVOS del MISMO equipo del roadmap.
 *  - La autorización se resuelve SIEMPRE en backend (aquí) y además en RLS
 *    (`roadmap_role`, `can_read_roadmap`, `can_write_roadmap`,
 *    `is_roadmap_admin`). Nada depende del cliente ni de localStorage.
 */
import type { RoadGateContext } from "../context";
import { ForbiddenError, NotFoundError, ValidationError, unwrap } from "../errors";
import {
  parseInput,
  roadmapRefInput,
  shareRoadmapInput,
  roadmapMemberRefInput,
  updateRoadmapMemberInput,
  transferRoadmapAdminInput,
} from "../schemas";
import { recordAuditEvent } from "./audit-service";

/** Rol efectivo del actor sobre un roadmap. */
export type RoadmapRole = "admin" | "editor" | "viewer";

/** Nivel de acceso requerido por un caso de uso. */
export type AccessLevel = "read" | "write" | "admin";

/** Miembro con acceso al roadmap, tal y como lo pinta el diálogo Compartir. */
export type RoadmapMemberView = {
  /** Id de la fila de `roadmap_members`; `null` para el Admin (no tiene fila). */
  id: string | null;
  teamMemberId: string;
  userId: string;
  email: string;
  role: RoadmapRole;
  createdAt: string | null;
};

/** Candidato del equipo con el que todavía se puede compartir. */
export type ShareCandidate = {
  teamMemberId: string;
  userId: string;
  email: string;
  teamRole: "admin" | "member";
};

type RoadmapRow = { id: string; user_id: string; team_id: string | null };

async function readRoadmapRow(
  ctx: RoadGateContext,
  roadmapId: string,
): Promise<RoadmapRow | null> {
  const row = unwrap(
    await ctx.db.from("roadmaps").select("id, user_id, team_id").eq("id", roadmapId).maybeSingle(),
    "readRoadmapRow",
  ) as unknown as RoadmapRow | null;
  return row ?? null;
}

/** Membresía ACTIVA del actor en un equipo concreto (o `null`). */
async function readActiveMembership(
  ctx: RoadGateContext,
  teamId: string | null,
): Promise<{ id: string; team_id: string } | null> {
  if (!teamId) return null;
  const rows = unwrap(
    await ctx.db
      .from("team_members")
      .select("id, team_id")
      .eq("user_id", ctx.userId)
      .eq("status", "active"),
    "readActiveMembership",
  ) as unknown as Array<{ id: string; team_id: string }> | null;
  return (rows ?? []).find((r) => r.team_id === teamId) ?? null;
}

/**
 * Resuelve el rol del actor sobre el roadmap. Devuelve `null` si no tiene
 * ningún acceso (o el roadmap no existe): quien llama decide si eso es 404.
 */
export async function getRoadmapRole(
  ctx: RoadGateContext,
  roadmapId: string,
): Promise<RoadmapRole | null> {
  const rm = await readRoadmapRow(ctx, roadmapId);
  if (!rm) return null;
  if (rm.user_id === ctx.userId) return "admin";

  const membership = await readActiveMembership(ctx, rm.team_id);
  if (!membership) return null;

  const share = unwrap(
    await ctx.db
      .from("roadmap_members")
      .select("role")
      .eq("roadmap_id", roadmapId)
      .eq("team_member_id", membership.id)
      .maybeSingle(),
    "getRoadmapRole.share",
  ) as unknown as { role: RoadmapRole } | null;

  return share?.role ?? null;
}

/**
 * Guarda de autorización de TODOS los casos de uso que tocan un roadmap.
 * @throws NotFoundError si el actor no puede ni leerlo (no se distingue de
 *         "no existe" para no permitir enumerar ids ajenos).
 * @throws ForbiddenError si tiene acceso pero insuficiente para la operación.
 */
export async function requireRoadmapAccess(
  ctx: RoadGateContext,
  roadmapId: string,
  level: AccessLevel = "write",
): Promise<RoadmapRole> {
  const role = await getRoadmapRole(ctx, roadmapId);
  if (!role) throw new NotFoundError("Roadmap");
  if (level === "write" && role === "viewer") {
    throw new ForbiddenError("Your access to this roadmap is read-only");
  }
  if (level === "admin" && role !== "admin") {
    throw new ForbiddenError("Only the roadmap admin can perform this action");
  }
  return role;
}

/** Ids de todos los roadmaps que el actor puede LEER (propios + compartidos). */
export async function listAccessibleRoadmapIds(ctx: RoadGateContext): Promise<{
  owned: string[];
  shared: string[];
}> {
  const ownedRows = unwrap(
    await ctx.db.from("roadmaps").select("id").eq("user_id", ctx.userId),
    "listAccessibleRoadmapIds.owned",
  ) as unknown as Array<{ id: string }> | null;

  const memberships = unwrap(
    await ctx.db
      .from("team_members")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("status", "active"),
    "listAccessibleRoadmapIds.memberships",
  ) as unknown as Array<{ id: string }> | null;

  const memberIds = (memberships ?? []).map((m) => m.id);
  let shared: string[] = [];
  if (memberIds.length) {
    const shares = unwrap(
      await ctx.db
        .from("roadmap_members")
        .select("roadmap_id")
        .in("team_member_id", memberIds),
      "listAccessibleRoadmapIds.shares",
    ) as unknown as Array<{ roadmap_id: string }> | null;
    shared = (shares ?? []).map((s) => s.roadmap_id);
  }

  const owned = (ownedRows ?? []).map((r) => r.id);
  return { owned, shared: shared.filter((id) => !owned.includes(id)) };
}

/** Lista quién tiene acceso al roadmap (Admin incluido). Requiere lectura. */
export async function listRoadmapMembers(
  ctx: RoadGateContext,
  input: unknown,
): Promise<RoadmapMemberView[]> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "read");

  const rm = await readRoadmapRow(ctx, roadmapId);
  if (!rm) throw new NotFoundError("Roadmap");

  const shares = unwrap(
    await ctx.db
      .from("roadmap_members")
      .select("id, team_member_id, role, created_at")
      .eq("roadmap_id", roadmapId),
    "listRoadmapMembers.shares",
  ) as unknown as Array<{
    id: string;
    team_member_id: string;
    role: RoadmapRole;
    created_at: string;
  }> | null;

  const teamRows = unwrap(
    await ctx.db
      .from("team_members")
      .select("id, user_id, email, status")
      .eq("team_id", rm.team_id ?? ""),
    "listRoadmapMembers.team",
  ) as unknown as Array<{
    id: string;
    user_id: string;
    email: string | null;
    status: string;
  }> | null;

  const byId = new Map((teamRows ?? []).map((t) => [t.id, t]));
  const byUser = new Map((teamRows ?? []).map((t) => [t.user_id, t]));

  const admin = byUser.get(rm.user_id);
  const list: RoadmapMemberView[] = [
    {
      id: null,
      teamMemberId: admin?.id ?? "",
      userId: rm.user_id,
      email: admin?.email ?? "",
      role: "admin",
      createdAt: null,
    },
  ];

  for (const s of shares ?? []) {
    const tm = byId.get(s.team_member_id);
    list.push({
      id: s.id,
      teamMemberId: s.team_member_id,
      userId: tm?.user_id ?? "",
      email: tm?.email ?? "",
      role: s.role,
      createdAt: s.created_at,
    });
  }
  return list;
}

/**
 * Miembros ACTIVOS del equipo del roadmap con los que aún se puede compartir.
 * Solo el Admin puede consultarlo: es el buscador del diálogo Compartir.
 */
export async function listShareCandidates(
  ctx: RoadGateContext,
  input: unknown,
): Promise<ShareCandidate[]> {
  const { roadmapId } = parseInput(roadmapRefInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "admin");

  const rm = await readRoadmapRow(ctx, roadmapId);
  if (!rm) throw new NotFoundError("Roadmap");

  const teamRows = unwrap(
    await ctx.db
      .from("team_members")
      .select("id, user_id, email, role, status")
      .eq("team_id", rm.team_id ?? "")
      .eq("status", "active"),
    "listShareCandidates.team",
  ) as unknown as Array<{
    id: string;
    user_id: string;
    email: string | null;
    role: "admin" | "member";
  }> | null;

  const shares = unwrap(
    await ctx.db.from("roadmap_members").select("team_member_id").eq("roadmap_id", roadmapId),
    "listShareCandidates.shares",
  ) as unknown as Array<{ team_member_id: string }> | null;
  const taken = new Set((shares ?? []).map((s) => s.team_member_id));

  return (teamRows ?? [])
    .filter((t) => t.user_id !== rm.user_id && !taken.has(t.id))
    .map((t) => ({
      teamMemberId: t.id,
      userId: t.user_id,
      email: t.email ?? "",
      teamRole: t.role,
    }));
}

/** Comprueba que el destinatario es miembro activo del equipo del roadmap. */
async function assertShareableTarget(
  ctx: RoadGateContext,
  rm: RoadmapRow,
  teamMemberId: string,
): Promise<{ id: string; user_id: string }> {
  const target = unwrap(
    await ctx.db
      .from("team_members")
      .select("id, user_id, team_id, status")
      .eq("id", teamMemberId)
      .maybeSingle(),
    "assertShareableTarget",
  ) as unknown as { id: string; user_id: string; team_id: string; status: string } | null;

  if (!target || target.status !== "active" || target.team_id !== rm.team_id) {
    throw new ValidationError("The selected member is not an active member of this team");
  }
  if (target.user_id === rm.user_id) {
    throw new ValidationError("The roadmap admin already has full access");
  }
  return target;
}

/** Comparte el roadmap con un miembro del equipo como Editor o Viewer. */
export async function shareRoadmap(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true; id: string }> {
  const { roadmapId, teamMemberId, role } = parseInput(shareRoadmapInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "admin");

  const rm = await readRoadmapRow(ctx, roadmapId);
  if (!rm) throw new NotFoundError("Roadmap");
  await assertShareableTarget(ctx, rm, teamMemberId);

  const existing = unwrap(
    await ctx.db
      .from("roadmap_members")
      .select("id")
      .eq("roadmap_id", roadmapId)
      .eq("team_member_id", teamMemberId)
      .maybeSingle(),
    "shareRoadmap.existing",
  ) as unknown as { id: string } | null;

  if (existing) {
    unwrap(
      await ctx.db
        .from("roadmap_members")
        .update({ role, updated_by: ctx.userId })
        .eq("id", existing.id),
      "shareRoadmap.update",
    );
    await recordAuditEvent(ctx, {
      teamId: rm.team_id ?? "",
      action: "roadmap.role_changed",
      roadmapId: roadmapId,
      metadata: { teamMemberId, role, kind: "update" },
    });
    return { ok: true, id: existing.id };
  }

  const row = unwrap(
    await ctx.db
      .from("roadmap_members")
      .insert({
        roadmap_id: roadmapId,
        team_member_id: teamMemberId,
        role,
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select("id")
      .single(),
    "shareRoadmap.insert",
  ) as unknown as { id: string };

  await recordAuditEvent(ctx, {
    teamId: rm.team_id ?? "",
    action: "roadmap.role_changed",
    roadmapId: roadmapId,
    metadata: { teamMemberId, role, kind: "grant" },
  });

  return { ok: true, id: row.id };
}

/** Cambia el rol (editor ↔ viewer) de un acceso ya concedido. */
export async function updateRoadmapMemberRole(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId, memberId, role } = parseInput(updateRoadmapMemberInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "admin");

  const existing = unwrap(
    await ctx.db
      .from("roadmap_members")
      .select("id")
      .eq("id", memberId)
      .eq("roadmap_id", roadmapId)
      .maybeSingle(),
    "updateRoadmapMemberRole.existing",
  ) as unknown as { id: string } | null;
  if (!existing) throw new NotFoundError("Roadmap member");

  unwrap(
    await ctx.db
      .from("roadmap_members")
      .update({ role, updated_by: ctx.userId })
      .eq("id", memberId)
      .eq("roadmap_id", roadmapId),
    "updateRoadmapMemberRole.update",
  );

  const rm = await readRoadmapRow(ctx, roadmapId);
  await recordAuditEvent(ctx, {
    teamId: rm?.team_id ?? "",
    action: "roadmap.role_changed",
    roadmapId: roadmapId,
    metadata: { memberId, role, kind: "update" },
  });
  return { ok: true };
}

/** Retira el acceso de un miembro. Surte efecto inmediato (backend + RLS). */
export async function revokeRoadmapMember(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId, memberId } = parseInput(roadmapMemberRefInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "admin");
  unwrap(
    await ctx.db
      .from("roadmap_members")
      .delete()
      .eq("id", memberId)
      .eq("roadmap_id", roadmapId),
    "revokeRoadmapMember",
  );

  const rm = await readRoadmapRow(ctx, roadmapId);
  await recordAuditEvent(ctx, {
    teamId: rm?.team_id ?? "",
    action: "roadmap.access_revoked",
    roadmapId: roadmapId,
    metadata: { memberId },
  });
  return { ok: true };
}

/**
 * Transfiere la administración del roadmap. Es TRANSACCIONAL: la hace la
 * función SQL `transfer_roadmap_admin`, que en la misma transacción convierte
 * al Admin anterior en Editor y deja un único Admin.
 */
export async function transferRoadmapAdmin(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ ok: true }> {
  const { roadmapId, teamMemberId } = parseInput(transferRoadmapAdminInput, input);
  await requireRoadmapAccess(ctx, roadmapId, "admin");

  const rm = await readRoadmapRow(ctx, roadmapId);
  if (!rm) throw new NotFoundError("Roadmap");
  await assertShareableTarget(ctx, rm, teamMemberId);

  const { error } = await ctx.db.rpc("transfer_roadmap_admin", {
    _roadmap_id: roadmapId,
    _team_member_id: teamMemberId,
  });
  if (error) {
    if (error.message.includes("transfer_forbidden")) {
      throw new ForbiddenError("Only the roadmap admin can transfer administration");
    }
    if (error.message.includes("transfer_invalid_member")) {
      throw new ValidationError("The selected member cannot become roadmap admin");
    }
    throw new ValidationError(`Transfer failed: ${error.message}`);
  }

  await recordAuditEvent(ctx, {
    teamId: rm.team_id ?? "",
    action: "roadmap.admin_transferred",
    roadmapId: roadmapId,
    metadata: { toTeamMemberId: teamMemberId },
  });
  return { ok: true };
}
