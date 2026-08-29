/**
 * Fase 5 · Pruebas del modelo comercial por miembro activo.
 * Cubren los cinco estados (trialing, active, past_due, grace_period,
 * cancelled), el conteo de asientos, el bloqueo por límite y la ausencia de
 * efectos destructivos ante un downgrade.
 */
import { describe, it, expect } from "vitest";
import { createFakeDb } from "@/test/fake-db";
import {
  computeEffectiveStatus,
  getBillingState,
  assertSeatAvailable,
  assertTeamWritable,
  requireBillingAdmin,
  normalizePlan,
} from "./billing-service";
import type { RoadGateContext } from "../context";

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

function ctxFor(team: Record<string, unknown>, members: Record<string, unknown>[]) {
  const { db } = createFakeDb({ teams: [team], team_members: members }, "u-admin");
  return { db, userId: "u-admin", email: "admin@test.dev" } as RoadGateContext;
}

const baseTeam = (over: Record<string, unknown> = {}) => ({
  id: "t-1",
  name: "Team",
  status: "active",
  plan: "team",
  seat_limit: 5,
  subscription_status: "active",
  trial_ends_at: null,
  grace_days: 7,
  current_period_end: null,
  billing_provider: null,
  ...over,
});

const admin = { id: "m-1", team_id: "t-1", user_id: "u-admin", role: "admin", status: "active", created_at: iso(-10) };
const member = (n: number, status = "active") => ({
  id: `m-${n}`,
  team_id: "t-1",
  user_id: `u-${n}`,
  role: "member",
  status,
  created_at: iso(-5),
});

describe("computeEffectiveStatus", () => {
  it("trial vigente permite escritura", () => {
    const r = computeEffectiveStatus({ subscription_status: "trialing", trial_ends_at: iso(3), grace_days: 7, current_period_end: null });
    expect(r).toMatchObject({ effectiveStatus: "trialing", readOnly: false });
  });

  it("trial expirado entra en gracia de solo lectura", () => {
    const r = computeEffectiveStatus({ subscription_status: "trialing", trial_ends_at: iso(-1), grace_days: 7, current_period_end: null });
    expect(r).toMatchObject({ effectiveStatus: "grace_period", readOnly: true });
  });

  it("tras la gracia queda cancelado y en solo lectura", () => {
    const r = computeEffectiveStatus({ subscription_status: "trialing", trial_ends_at: iso(-30), grace_days: 7, current_period_end: null });
    expect(r).toMatchObject({ effectiveStatus: "cancelled", readOnly: true });
  });

  it("active escribe con normalidad", () => {
    const r = computeEffectiveStatus({ subscription_status: "active", trial_ends_at: null, grace_days: 7, current_period_end: iso(20) });
    expect(r).toMatchObject({ effectiveStatus: "active", readOnly: false });
  });

  it("past_due conserva escritura durante la gracia y la pierde después", () => {
    expect(
      computeEffectiveStatus({ subscription_status: "past_due", trial_ends_at: null, grace_days: 7, current_period_end: iso(-2) }),
    ).toMatchObject({ effectiveStatus: "past_due", readOnly: false });
    expect(
      computeEffectiveStatus({ subscription_status: "past_due", trial_ends_at: null, grace_days: 7, current_period_end: iso(-20) }),
    ).toMatchObject({ effectiveStatus: "grace_period", readOnly: true });
  });

  it("cancelled es siempre solo lectura", () => {
    expect(
      computeEffectiveStatus({ subscription_status: "cancelled", trial_ends_at: null, grace_days: 7, current_period_end: null }),
    ).toMatchObject({ readOnly: true });
  });
});

describe("normalizePlan", () => {
  it("mapea el plan legado free a team", () => {
    expect(normalizePlan("free")).toBe("team");
    expect(normalizePlan("solo")).toBe("solo");
    expect(normalizePlan(null)).toBe("team");
  });
});

describe("getBillingState", () => {
  it("cuenta al Team Admin como asiento", async () => {
    const ctx = ctxFor(baseTeam(), [admin, member(2)]);
    const state = await getBillingState(ctx);
    expect(state.seatsUsed).toBe(2);
    expect(state.seatLimit).toBe(5);
    expect(state.seatsAvailable).toBe(3);
    expect(state.overSeatLimit).toBe(false);
  });

  it("los miembros inactivos no consumen asiento", async () => {
    const ctx = ctxFor(baseTeam(), [admin, member(2, "inactive")]);
    expect((await getBillingState(ctx)).seatsUsed).toBe(1);
  });

  it("un downgrade con exceso se señala sin desactivar a nadie", async () => {
    const members = [admin, member(2), member(3)];
    const ctx = ctxFor(baseTeam({ plan: "solo", seat_limit: 1 }), members);
    const state = await getBillingState(ctx);
    expect(state.overSeatLimit).toBe(true);
    expect(state.seatLimit).toBe(1);
    expect(members.every((m) => m.status === "active")).toBe(true);
  });

  it("recorta el seat_limit al tope duro del plan", async () => {
    const ctx = ctxFor(baseTeam({ plan: "solo", seat_limit: 99 }), [admin]);
    expect((await getBillingState(ctx)).seatLimit).toBe(1);
  });

  it("business habilita API e integraciones", async () => {
    const ctx = ctxFor(baseTeam({ plan: "business", seat_limit: 25 }), [admin]);
    const state = await getBillingState(ctx);
    expect(state.features).toEqual({ collaboration: true, api: true });
  });
});

describe("assertSeatAvailable", () => {
  it("permite añadir mientras queden asientos", async () => {
    const ctx = ctxFor(baseTeam(), [admin]);
    await expect(assertSeatAvailable(ctx, "t-1")).resolves.toBeUndefined();
  });

  it("bloquea al alcanzar el límite y pide upgrade", async () => {
    const ctx = ctxFor(baseTeam({ plan: "solo", seat_limit: 1 }), [admin]);
    await expect(assertSeatAvailable(ctx, "t-1")).rejects.toMatchObject({
      code: "conflict",
      details: { upgradeRequired: true },
    });
  });
});

describe("assertTeamWritable", () => {
  it("deja escribir durante el trial", async () => {
    const ctx = ctxFor(baseTeam({ subscription_status: "trialing", trial_ends_at: iso(5) }), [admin]);
    await expect(assertTeamWritable(ctx)).resolves.toBeUndefined();
  });

  it("bloquea la escritura en periodo de gracia", async () => {
    const ctx = ctxFor(baseTeam({ subscription_status: "trialing", trial_ends_at: iso(-2) }), [admin]);
    await expect(assertTeamWritable(ctx)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("bloquea la escritura si está cancelada", async () => {
    const ctx = ctxFor(baseTeam({ subscription_status: "cancelled" }), [admin]);
    await expect(assertTeamWritable(ctx)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("requireBillingAdmin", () => {
  it("un miembro no admin no puede gestionar la suscripción", async () => {
    const { db } = createFakeDb(
      {
        teams: [baseTeam()],
        team_members: [admin, { ...member(2), user_id: "u-2" }],
      },
      "u-2",
    );
    const ctx = { db, userId: "u-2", email: "m@test.dev" } as RoadGateContext;
    await expect(requireBillingAdmin(ctx)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("el Team Admin sí puede", async () => {
    const ctx = ctxFor(baseTeam(), [admin]);
    await expect(requireBillingAdmin(ctx)).resolves.toMatchObject({ role: "admin" });
  });
});
