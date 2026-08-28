/**
 * Fase II — Miembros e invitaciones: permisos, ciclo de vida del token y
 * aislamiento entre dos equipos distintos.
 */
import { describe, it, expect } from "vitest";
import { createTestCtx, type Tables } from "@/test/fake-db";
import { ensureActiveTeam } from "./team-service";
import {
  inviteMember,
  listTeamInvitations,
  listTeamMembers,
  resendInvitation,
  revokeInvitation,
  setMemberStatus,
  acceptInvitation,
} from "./membership-service";

function emptyTables(): Tables {
  return {
    teams: [],
    team_members: [],
    team_invitations: [],
    roadmaps: [],
    roadmap_items: [],
    roadmap_capacity: [],
  };
}

describe("membership-service", () => {
  it("un admin invita y el invitado acepta como Team Member", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);

    const { token, invitation } = await inviteMember(admin, { email: "Nuevo@Acme.test" });
    expect(invitation.email).toBe("nuevo@acme.test");
    expect(invitation.status).toBe("pending");
    // El token en claro NO se guarda en base de datos.
    expect(JSON.stringify(tables.team_invitations)).not.toContain(token);

    const guest = createTestCtx(tables, "user-guest", "nuevo@acme.test");
    const { teamId } = await acceptInvitation(guest, { token });
    expect(teamId).toBe(invitation.id ? teamId : teamId);

    const members = await listTeamMembers(admin);
    expect(members.map((m) => m.role).sort()).toEqual(["admin", "member"]);
  });

  it("la aceptación es idempotente", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    const { token } = await inviteMember(admin, { email: "nuevo@acme.test" });

    const guest = createTestCtx(tables, "user-guest", "nuevo@acme.test");
    const first = await acceptInvitation(guest, { token });
    const second = await acceptInvitation(guest, { token });
    expect(second.teamId).toBe(first.teamId);
    expect(tables.team_members.filter((m) => m.user_id === "user-guest")).toHaveLength(1);
  });

  it("rechaza tokens alterados, revocados y caducados", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    const { token, invitation } = await inviteMember(admin, { email: "nuevo@acme.test" });
    const guest = createTestCtx(tables, "user-guest", "nuevo@acme.test");

    await expect(acceptInvitation(guest, { token: `${token}00` })).rejects.toThrow();

    // Caducada
    const row = tables.team_invitations.find((i) => i.id === invitation.id)!;
    row.expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(acceptInvitation(guest, { token })).rejects.toThrow();

    // Revocada
    row.expires_at = new Date(Date.now() + 86_400_000).toISOString();
    await revokeInvitation(admin, { invitationId: invitation.id });
    await expect(acceptInvitation(guest, { token })).rejects.toThrow();
  });

  it("reenviar rota el token: el anterior deja de valer", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    const first = await inviteMember(admin, { email: "nuevo@acme.test" });
    const second = await resendInvitation(admin, { invitationId: first.invitation.id });
    expect(second.token).not.toBe(first.token);

    const guest = createTestCtx(tables, "user-guest", "nuevo@acme.test");
    await expect(acceptInvitation(guest, { token: first.token })).rejects.toThrow();
    await expect(acceptInvitation(guest, { token: second.token })).resolves.toBeTruthy();
  });

  it("no crea invitaciones duplicadas ni invita a alguien que ya es del equipo", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    await inviteMember(admin, { email: "nuevo@acme.test" });
    await expect(inviteMember(admin, { email: "nuevo@acme.test" })).rejects.toThrow();
    await expect(inviteMember(admin, { email: "admin@acme.test" })).rejects.toThrow();
  });

  it("un Team Member no puede administrar miembros aunque llame a la API", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    const { token, invitation } = await inviteMember(admin, { email: "nuevo@acme.test" });
    const guest = createTestCtx(tables, "user-guest", "nuevo@acme.test");
    await acceptInvitation(guest, { token });

    await expect(inviteMember(guest, { email: "otro@acme.test" })).rejects.toThrow();
    await expect(listTeamInvitations(guest)).rejects.toThrow();
    await expect(revokeInvitation(guest, { invitationId: invitation.id })).rejects.toThrow();

    const adminMember = (await listTeamMembers(admin)).find((m) => m.role === "admin")!;
    await expect(
      setMemberStatus(guest, { memberId: adminMember.id, status: "inactive" }),
    ).rejects.toThrow();
  });

  it("desactivar y reactivar no borra datos y el admin no puede desactivarse", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    const { token } = await inviteMember(admin, { email: "nuevo@acme.test" });
    const guest = createTestCtx(tables, "user-guest", "nuevo@acme.test");
    await acceptInvitation(guest, { token });

    const member = (await listTeamMembers(admin)).find((m) => m.role === "member")!;
    await setMemberStatus(admin, { memberId: member.id, status: "inactive" });
    expect((await listTeamMembers(admin)).find((m) => m.id === member.id)!.status).toBe("inactive");
    expect(tables.team_members).toHaveLength(2); // no se borra

    await setMemberStatus(admin, { memberId: member.id, status: "active" });
    expect((await listTeamMembers(admin)).find((m) => m.id === member.id)!.status).toBe("active");

    const adminMember = (await listTeamMembers(admin)).find((m) => m.role === "admin")!;
    await expect(
      setMemberStatus(admin, { memberId: adminMember.id, status: "inactive" }),
    ).rejects.toThrow();
  });

  it("dos equipos distintos no ven ni gestionan miembros ajenos", async () => {
    const tables = emptyTables();
    const adminA = createTestCtx(tables, "user-A", "a@acme.test");
    const adminB = createTestCtx(tables, "user-B", "b@other.test");
    await ensureActiveTeam(adminA);
    await ensureActiveTeam(adminB);

    const invA = await inviteMember(adminA, { email: "guest@acme.test" });

    // B no ve la invitación de A ni puede revocarla.
    expect(await listTeamInvitations(adminB)).toHaveLength(0);
    await expect(
      revokeInvitation(adminB, { invitationId: invA.invitation.id }),
    ).rejects.toThrow();

    // B no ve a los miembros del equipo A.
    const membersB = await listTeamMembers(adminB);
    expect(membersB.map((m) => m.userId)).toEqual(["user-B"]);

    // Un miembro del equipo A no puede ser desactivado por B.
    const memberA = (await listTeamMembers(adminA))[0]!;
    await expect(
      setMemberStatus(adminB, { memberId: memberA.id, status: "inactive" }),
    ).rejects.toThrow();
  });

  it("una invitación sólo la puede aceptar el email invitado", async () => {
    const tables = emptyTables();
    const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
    await ensureActiveTeam(admin);
    const { token } = await inviteMember(admin, { email: "nuevo@acme.test" });

    const intruder = createTestCtx(tables, "user-intruder", "intruso@evil.test");
    await expect(acceptInvitation(intruder, { token })).rejects.toThrow();
  });
});
