/**
 * Fase 4 — Offboarding y auditoría administrativa.
 * Se prueba contra el doble de BD: reglas de desactivación (último admin,
 * roadmaps administrados, no destructividad) y registro de eventos.
 */
import { describe, it, expect } from "vitest";
import { createTestCtx, type Tables } from "@/test/fake-db";
import {
  ensureActiveTeam,
  inviteMember,
  acceptInvitation,
  listTeamMembers,
  setMemberStatus,
  listMemberAdminRoadmaps,
  listAuditEvents,
} from "@/core";

function emptyTables(): Tables {
  return {
    teams: [],
    team_members: [],
    team_invitations: [],
    roadmaps: [],
    roadmap_items: [],
    audit_events: [],
  };
}

async function teamWithGuest() {
  const tables = emptyTables();
  const admin = createTestCtx(tables, "user-admin", "admin@acme.test");
  await ensureActiveTeam(admin);
  const { token } = await inviteMember(admin, { email: "guest@acme.test" });
  const guest = createTestCtx(tables, "user-guest", "guest@acme.test");
  await acceptInvitation(guest, { token });
  const member = (await listTeamMembers(admin)).find((m) => m.role === "member")!;
  const team = tables.teams[0]! as { id: string };
  return { tables, admin, guest, member, teamId: team.id };
}

describe("Fase 4 · offboarding", () => {
  it("no permite desactivar al último Team Admin", async () => {
    const { admin } = await teamWithGuest();
    const adminMember = (await listTeamMembers(admin)).find((m) => m.role === "admin")!;
    await expect(
      setMemberStatus(admin, { memberId: adminMember.id, status: "inactive" }),
    ).rejects.toThrow(/last team admin/i);
  });

  it("bloquea la desactivación si la persona administra roadmaps", async () => {
    const { tables, admin, member, teamId } = await teamWithGuest();
    tables.roadmaps.push({
      id: "rm-1",
      name: "Producto 2026",
      user_id: "user-guest",
      team_id: teamId,
      admin_member_id: member.id,
    });

    expect(await listMemberAdminRoadmaps(admin, { memberId: member.id })).toEqual([
      { id: "rm-1", name: "Producto 2026" },
    ]);

    await expect(
      setMemberStatus(admin, { memberId: member.id, status: "inactive" }),
    ).rejects.toThrow(/Producto 2026/);

    // Tras transferir la administración a otra persona, ya se puede desactivar.
    tables.roadmaps[0]!["user_id"] = "user-admin";
    await setMemberStatus(admin, { memberId: member.id, status: "inactive" });
    expect(tables.roadmaps).toHaveLength(1); // no se borra nada
    expect(tables.team_members).toHaveLength(2);
  });

  it("registra eventos administrativos y sólo el Team Admin los lee", async () => {
    const { admin, guest, member } = await teamWithGuest();
    await setMemberStatus(admin, { memberId: member.id, status: "inactive" });

    const events = await listAuditEvents(admin);
    const actions = events.map((e) => e.action);
    expect(actions).toContain("invitation.sent");
    expect(actions).toContain("invitation.accepted");
    expect(actions).toContain("member.status_changed");

    await expect(listAuditEvents(guest)).rejects.toThrow();
  });

  it("los eventos están acotados por equipo", async () => {
    const { tables, admin, teamId } = await teamWithGuest();
    const events = await listAuditEvents(admin);
    expect(events.length).toBeGreaterThan(0);
    const rows = tables.audit_events as Array<{ team_id: string }>;
    expect(new Set(rows.map((r) => r.team_id))).toEqual(new Set([teamId]));
  });
});
