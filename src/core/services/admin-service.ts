import type { RoadGateContext } from "../context";
import { ForbiddenError } from "../errors";

export async function isGlobalAdmin(ctx: RoadGateContext): Promise<boolean> {
  const { data, error } = await ctx.db.from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error("Could not verify administrator access");
  return data?.role === "admin";
}

export async function listAdminRegistrations(ctx: RoadGateContext, page = 0) {
  if (!(await isGlobalAdmin(ctx))) throw new ForbiddenError("Administrator access required");
  const safePage = Number.isSafeInteger(page) && page >= 0 ? page : 0;
  const { data, error } = await ctx.db.rpc("list_admin_registrations", { _limit: 50, _offset: safePage * 50 });
  if (error) throw new Error("Could not load registered users");
  return data ?? [];
}