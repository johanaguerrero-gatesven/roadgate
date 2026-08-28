/**
 * =============================================================================
 * Pruebas de la colaboración por roadmap (Fase III)
 * =============================================================================
 * Verifican en el CORE (no sólo en RLS) que Admin, Editor y Viewer tienen
 * exactamente los permisos previstos y que nadie de otro equipo entra.
 */
import { describe, it, expect } from "vitest";
import { createFakeDb } from "@/test/fake-db";
import {
  getRoadmapRole,
  requireRoadmapAccess,
  listAccessibleRoadmapIds,
  listShareCandidates,
  shareRoadmap,
  revokeRoadmapMember,
} from "./sharing-service";
import { listRoadmaps } from "./roadmap-service";
import type { RoadGateContext } from "../context";

/** Equipo A: admin (user-1), editor (user-2), viewer (user-3). Equipo B: user-9. */
function seed() {
  return {
    roadmaps: [
      { id: "rm-1", user_id: "user-1", team_id: "team-a", name: "A", created_at: "2026-01-01", updated_at: "2026-01-01" },
      { id: "rm-9", user_id: "user-9", team_id: "team-b", name: "B", created_at: "2026-01-01", updated_at: "2026-01-01" },
    ],
    team_members: [
      { id: "tm-1", team_id: "team-a", user_id: "user-1", role: "admin", status: "active", email: "a@x.test" },
      { id: "tm-2", team_id: "team-a", user_id: "user-2", role: "member", status: "active", email: "b@x.test" },
      { id: "tm-3", team_id: "team-a", user_id: "user-3", role: "member", status: "active", email: "c@x.test" },
      { id: "tm-9", team_id: "team-b", user_id: "user-9", role: "admin", status: "active", email: "z@x.test" },
    ],
    roadmap_members: [
      { id: "rmm-2", roadmap_id: "rm-1", team_member_id: "tm-2", role: "editor", created_at: "2026-01-02" },
      { id: "rmm-3", roadmap_id: "rm-1", team_member_id: "tm-3", role: "viewer", created_at: "2026-01-02" },
    ],
    roadmap_items: [],
  };
}

function ctxFor(userId: string, tables: ReturnType<typeof seed>): RoadGateContext {
  const { db } = createFakeDb(tables as never, userId);
  return { db, userId, email: `${userId}@x.test` };
}

describe("sharing-service · roles efectivos", () => {
  it("el creador es Admin, los compartidos Editor/Viewer y los ajenos no tienen rol", async () => {
    const t = seed();
    expect(await getRoadmapRole(ctxFor("user-1", t), "rm-1")).toBe("admin");
    expect(await getRoadmapRole(ctxFor("user-2", t), "rm-1")).toBe("editor");
    expect(await getRoadmapRole(ctxFor("user-3", t), "rm-1")).toBe("viewer");
    expect(await getRoadmapRole(ctxFor("user-9", t), "rm-1")).toBeNull();
  });

  it("Viewer puede leer pero no escribir", async () => {
    const t = seed();
    const ctx = ctxFor("user-3", t);
    await expect(requireRoadmapAccess(ctx, "rm-1", "read")).resolves.toBe("viewer");
    await expect(requireRoadmapAccess(ctx, "rm-1", "write")).rejects.toThrow();
  });

  it("Editor escribe pero no administra", async () => {
    const t = seed();
    const ctx = ctxFor("user-2", t);
    await expect(requireRoadmapAccess(ctx, "rm-1", "write")).resolves.toBe("editor");
    await expect(requireRoadmapAccess(ctx, "rm-1", "admin")).rejects.toThrow();
  });

  it("un usuario de otro equipo recibe 404 al pedir acceso", async () => {
    const t = seed();
    await expect(requireRoadmapAccess(ctxFor("user-9", t), "rm-1", "read")).rejects.toThrow();
  });
});

describe("sharing-service · listados", () => {
  it("separa roadmaps propios de compartidos", async () => {
    const t = seed();
    expect(await listAccessibleRoadmapIds(ctxFor("user-1", t))).toEqual({ owned: ["rm-1"], shared: [] });
    expect(await listAccessibleRoadmapIds(ctxFor("user-2", t))).toEqual({ owned: [], shared: ["rm-1"] });
  });

  it("listRoadmaps marca el rol y el flag shared", async () => {
    const t = seed();
    const rows = await listRoadmaps(ctxFor("user-2", t));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "rm-1", role: "editor", shared: true });
  });

  it("los candidatos a compartir excluyen al admin y a quien ya tiene acceso", async () => {
    const t = seed();
    t.roadmap_members = [{ id: "rmm-2", roadmap_id: "rm-1", team_member_id: "tm-2", role: "editor", created_at: "x" }];
    const candidates = await listShareCandidates(ctxFor("user-1", t), { roadmapId: "rm-1" });
    expect(candidates.map((c) => c.teamMemberId)).toEqual(["tm-3"]);
  });
});

describe("sharing-service · mutaciones administrativas", () => {
  it("sólo el Admin puede compartir", async () => {
    const t = seed();
    await expect(
      shareRoadmap(ctxFor("user-2", t), { roadmapId: "rm-1", teamMemberId: "tm-3", role: "editor" }),
    ).rejects.toThrow();
  });

  it("no se puede compartir con alguien de otro equipo", async () => {
    const t = seed();
    await expect(
      shareRoadmap(ctxFor("user-1", t), { roadmapId: "rm-1", teamMemberId: "tm-9", role: "editor" }),
    ).rejects.toThrow();
  });

  it("retirar el acceso lo elimina de inmediato", async () => {
    const t = seed();
    await revokeRoadmapMember(ctxFor("user-1", t), { roadmapId: "rm-1", memberId: "rmm-3" });
    expect(await getRoadmapRole(ctxFor("user-3", t), "rm-1")).toBeNull();
  });
});
