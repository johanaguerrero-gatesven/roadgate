import { describe, expect, it, vi } from "vitest";
import type { RoadGateContext } from "../context";
import { isGlobalAdmin, listAdminRegistrations } from "./admin-service";

function context(role: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null });
  const eq = vi.fn().mockReturnThis();
  const rpc = vi.fn().mockResolvedValue({ data: [
    { user_id: "creator", email: "creator@example.com", roadmap_count: 3 },
    { user_id: "zero", email: "zero@example.com", roadmap_count: 0 },
  ], error: null });
  const db = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq, maybeSingle }) }), rpc };
  return { ctx: { userId: "johana", db } as unknown as RoadGateContext, rpc, eq };
}

describe("exclusive global administration", () => {
  it("requires a global admin role scoped to the verified account", async () => {
    const { ctx, eq } = context("admin");
    expect(await isGlobalAdmin(ctx)).toBe(true);
    expect(eq).toHaveBeenCalledWith("user_id", "johana");
    expect(eq).toHaveBeenCalledWith("role", "admin");
  });
  it("does not grant global access to team administrators or ordinary users", async () => {
    const { ctx, rpc } = context(null);
    await expect(listAdminRegistrations(ctx)).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns users with zero roadmaps as well as creators", async () => {
    const { ctx } = context("admin");
    expect((await listAdminRegistrations(ctx)).map(row => Number(row.roadmap_count))).toEqual([3, 0]);
  });
  it("paginates with a fixed limit and offset", async () => {
    const { ctx, rpc } = context("admin");
    await listAdminRegistrations(ctx, 2);
    expect(rpc).toHaveBeenCalledWith("list_admin_registrations", { _limit: 50, _offset: 100 });
  });
});