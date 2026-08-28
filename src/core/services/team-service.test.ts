/**
 * Fase I — Cuenta de equipo: provisión idempotente y aislamiento entre equipos.
 */
import { describe, it, expect } from "vitest";
import { createTestCtx, type Tables } from "@/test/fake-db";
import { ensureActiveTeam, getActiveTeam } from "./team-service";
import { createRoadmap, listRoadmaps, getRoadmap } from "./roadmap-service";

function emptyTables(): Tables {
  return { teams: [], team_members: [], roadmaps: [], roadmap_items: [], roadmap_capacity: [] };
}

describe("team-service", () => {
  it("crea equipo y membresía admin en el primer acceso", async () => {
    const tables = emptyTables();
    const ctx = createTestCtx(tables, "user-1");
    const team = await ensureActiveTeam(ctx);
    expect(team.role).toBe("admin");
    expect(tables.teams).toHaveLength(1);
    expect(tables.team_members).toHaveLength(1);
  });

  it("es idempotente: no duplica equipos", async () => {
    const tables = emptyTables();
    const ctx = createTestCtx(tables, "user-1");
    const a = await ensureActiveTeam(ctx);
    const b = await ensureActiveTeam(ctx);
    expect(a.id).toBe(b.id);
    expect(tables.teams).toHaveLength(1);
  });

  it("un roadmap nuevo queda asignado al equipo y a su admin", async () => {
    const tables = emptyTables();
    const ctx = createTestCtx(tables, "user-1");
    const { id } = await createRoadmap(ctx, { name: "Plan 2026" });
    const row = tables.roadmaps.find((r) => r.id === id)!;
    const team = (await getActiveTeam(ctx))!;
    expect(row.team_id).toBe(team.id);
    expect(row.admin_member_id).toBe(team.memberId);
  });

  it("dos usuarios de equipos distintos no ven datos cruzados", async () => {
    const tables = emptyTables();
    const ctxA = createTestCtx(tables, "user-A");
    const ctxB = createTestCtx(tables, "user-B");

    const a = await createRoadmap(ctxA, { name: "Roadmap A" });
    const b = await createRoadmap(ctxB, { name: "Roadmap B" });

    const listA = await listRoadmaps(ctxA);
    const listB = await listRoadmaps(ctxB);
    expect(listA.map((r) => r.id)).toEqual([a.id]);
    expect(listB.map((r) => r.id)).toEqual([b.id]);

    // Forzar el id del roadmap ajeno no da acceso.
    await expect(getRoadmap(ctxB, { roadmapId: a.id })).rejects.toThrow();
    await expect(getRoadmap(ctxA, { roadmapId: b.id })).rejects.toThrow();

    // Cada usuario tiene su propio equipo.
    const teamA = (await getActiveTeam(ctxA))!;
    const teamB = (await getActiveTeam(ctxB))!;
    expect(teamA.id).not.toBe(teamB.id);
  });
});
