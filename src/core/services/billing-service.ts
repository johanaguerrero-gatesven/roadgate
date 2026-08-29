/**
 * =============================================================================
 * Fase 5 · Comercialización simple por miembro activo
 * =============================================================================
 * Reglas del modelo (todas se resuelven EN SERVIDOR; el cliente sólo pinta):
 *
 *  - Planes: `solo` (1 asiento), `team` (5 ó 10) y `business` (límite superior
 *    y acceso a API/integraciones). El plan legado `free` se trata como `team`.
 *  - Un asiento = un miembro ACTIVO del equipo. El Team Admin también ocupa uno.
 *  - Equipos nuevos: trial de 14 días sin tarjeta (`ensure_personal_team`).
 *  - Al expirar el trial (o tras un impago) el equipo entra en `grace_period`:
 *    la cuenta pasa a SOLO LECTURA, pero NUNCA se desactivan miembros ni se
 *    borran datos.
 *  - Un downgrade con exceso de miembros no desactiva a nadie: simplemente
 *    bloquea invitar/reactivar hasta que el Admin resuelva el exceso a mano.
 *
 * La fuente de verdad es la tabla `teams` (columnas `plan`, `seat_limit`,
 * `subscription_status`, `trial_ends_at`, `grace_days`, `current_period_end`).
 * Un trigger de BD impide que un usuario autenticado modifique esos campos:
 * sólo los webhooks firmados (service role) pueden hacerlo.
 */
import type { RoadGateContext } from "../context";
import { unwrap, ForbiddenError, NotFoundError, ConflictError } from "../errors";
import { getActiveTeam, type ActiveTeam } from "./team-service";

/** Identificadores de plan comercializados. */
export type BillingPlan = "solo" | "team" | "business";

/** Estados de suscripción persistidos. */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "grace_period"
  | "cancelled";

export type PlanDefinition = {
  id: BillingPlan;
  /** Asientos máximos permitidos por el plan (tope duro). */
  maxSeats: number;
  /** Opciones de `seat_limit` configurables dentro del plan. */
  seatOptions: number[];
  /** ¿Permite colaboración Admin/Editor/Viewer? */
  collaboration: boolean;
  /** ¿Permite API keys e integraciones? */
  api: boolean;
};

/** Catálogo de planes. Vive en el core: no depende del proveedor de pagos. */
export const PLAN_CATALOG: Record<BillingPlan, PlanDefinition> = {
  solo: { id: "solo", maxSeats: 1, seatOptions: [1], collaboration: false, api: false },
  team: { id: "team", maxSeats: 10, seatOptions: [5, 10], collaboration: true, api: false },
  business: { id: "business", maxSeats: 50, seatOptions: [25, 50], collaboration: true, api: true },
};

/** Días de trial sin tarjeta para equipos nuevos (espejo de la función SQL). */
export const TRIAL_DAYS = 14;

/** Normaliza el plan almacenado (incluye el legado `free`). */
export function normalizePlan(raw: string | null | undefined): BillingPlan {
  if (raw === "solo" || raw === "team" || raw === "business") return raw;
  return "team"; // `free` y cualquier valor histórico → plan colaborativo básico
}

/** Estado comercial calculado del equipo. Es lo que consume la UI. */
export type BillingState = {
  teamId: string;
  plan: BillingPlan;
  /** Estado persistido tal cual está en BD. */
  status: SubscriptionStatus;
  /** Estado EFECTIVO tras aplicar el calendario (trial vencido, gracia, etc.). */
  effectiveStatus: SubscriptionStatus;
  /** `true` cuando la cuenta está en solo lectura por facturación. */
  readOnly: boolean;
  trialEndsAt: string | null;
  /** Fin del periodo de gracia (solo lectura) antes de cancelar. */
  graceEndsAt: string | null;
  graceDays: number;
  currentPeriodEnd: string | null;
  seatLimit: number;
  seatsUsed: number;
  seatsAvailable: number;
  /** `true` si el número de miembros activos supera el límite (tras downgrade). */
  overSeatLimit: boolean;
  /** Capacidades derivadas del plan. */
  features: { collaboration: boolean; api: boolean };
  /** Rol del actor en el equipo: sólo el Admin gestiona la suscripción. */
  role: "admin" | "member";
  provider: string | null;
};

type TeamBillingRow = {
  id: string;
  plan: string;
  seat_limit: number;
  subscription_status: string;
  trial_ends_at: string | null;
  grace_days: number;
  current_period_end: string | null;
  billing_provider: string | null;
};

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/**
 * Calcula el estado efectivo a partir de las fechas. Puro: fácil de testear.
 *
 *  trialing  → activo hasta `trial_ends_at`; después `grace_period`
 *              (solo lectura) durante `grace_days`; luego `cancelled`.
 *  past_due  → conserva escritura durante la gracia contada desde el fin de
 *              periodo; después `grace_period` (solo lectura) → `cancelled`.
 *  active    → escritura normal.
 *  grace_period / cancelled → solo lectura.
 */
export function computeEffectiveStatus(
  row: Pick<
    TeamBillingRow,
    "subscription_status" | "trial_ends_at" | "grace_days" | "current_period_end"
  >,
  now: Date = new Date(),
): { effectiveStatus: SubscriptionStatus; readOnly: boolean; graceEndsAt: string | null } {
  const status = (row.subscription_status ?? "trialing") as SubscriptionStatus;
  const t = now.getTime();
  const graceDays = row.grace_days ?? 7;

  if (status === "active") {
    return { effectiveStatus: "active", readOnly: false, graceEndsAt: null };
  }

  if (status === "trialing") {
    if (!row.trial_ends_at) return { effectiveStatus: "trialing", readOnly: false, graceEndsAt: null };
    const trialEnd = new Date(row.trial_ends_at).getTime();
    const graceEndsAt = addDays(row.trial_ends_at, graceDays);
    if (t <= trialEnd) return { effectiveStatus: "trialing", readOnly: false, graceEndsAt };
    if (t <= new Date(graceEndsAt).getTime()) {
      return { effectiveStatus: "grace_period", readOnly: true, graceEndsAt };
    }
    return { effectiveStatus: "cancelled", readOnly: true, graceEndsAt };
  }

  if (status === "past_due") {
    const anchor = row.current_period_end;
    if (!anchor) return { effectiveStatus: "past_due", readOnly: false, graceEndsAt: null };
    const graceEndsAt = addDays(anchor, graceDays);
    if (t <= new Date(graceEndsAt).getTime()) {
      return { effectiveStatus: "past_due", readOnly: false, graceEndsAt };
    }
    return { effectiveStatus: "grace_period", readOnly: true, graceEndsAt };
  }

  // grace_period / cancelled persistidos explícitamente por el proveedor.
  return { effectiveStatus: status, readOnly: true, graceEndsAt: null };
}

async function readTeamBilling(ctx: RoadGateContext, teamId: string): Promise<TeamBillingRow> {
  const row = unwrap(
    await ctx.db
      .from("teams")
      .select(
        "id,plan,seat_limit,subscription_status,trial_ends_at,grace_days,current_period_end,billing_provider",
      )
      .eq("id", teamId)
      .maybeSingle(),
    "readTeamBilling",
  ) as unknown as TeamBillingRow | null;
  if (!row) throw new NotFoundError("Team");
  return row;
}

async function countActiveSeats(ctx: RoadGateContext, teamId: string): Promise<number> {
  const rows = unwrap(
    await ctx.db
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("status", "active"),
    "countActiveSeats",
  ) as unknown as Array<{ id: string }> | null;
  return (rows ?? []).length;
}

/** Estado comercial del equipo activo del actor. */
export async function getBillingState(ctx: RoadGateContext): Promise<BillingState> {
  const team = await getActiveTeam(ctx);
  if (!team) throw new NotFoundError("Team");
  return buildBillingState(ctx, team);
}

async function buildBillingState(
  ctx: RoadGateContext,
  team: ActiveTeam,
): Promise<BillingState> {
  const row = await readTeamBilling(ctx, team.id);
  const plan = normalizePlan(row.plan);
  const definition = PLAN_CATALOG[plan];
  const seatLimit = Math.min(row.seat_limit ?? definition.maxSeats, definition.maxSeats);
  const seatsUsed = await countActiveSeats(ctx, team.id);
  const { effectiveStatus, readOnly, graceEndsAt } = computeEffectiveStatus(row);

  return {
    teamId: team.id,
    plan,
    status: (row.subscription_status ?? "trialing") as SubscriptionStatus,
    effectiveStatus,
    readOnly,
    trialEndsAt: row.trial_ends_at,
    graceEndsAt,
    graceDays: row.grace_days ?? 7,
    currentPeriodEnd: row.current_period_end,
    seatLimit,
    seatsUsed,
    seatsAvailable: Math.max(0, seatLimit - seatsUsed),
    overSeatLimit: seatsUsed > seatLimit,
    features: { collaboration: definition.collaboration, api: definition.api },
    role: team.role,
    provider: row.billing_provider,
  };
}

/**
 * Guarda de escritura por facturación. Se invoca en TODAS las mutaciones de
 * contenido: si el equipo está en gracia o cancelado, la cuenta es de solo
 * lectura. No borra ni desactiva nada.
 */
export async function assertTeamWritable(ctx: RoadGateContext): Promise<void> {
  const team = await getActiveTeam(ctx);
  if (!team) return; // Sin equipo todavía: la provisión lo creará en trial.
  const row = await readTeamBilling(ctx, team.id);
  const { effectiveStatus, readOnly } = computeEffectiveStatus(row);
  if (readOnly) {
    throw new ForbiddenError(
      effectiveStatus === "cancelled"
        ? "Your subscription has ended: the account is read-only until you upgrade"
        : "Your trial has expired: the account is read-only during the grace period",
    );
  }
}

/**
 * Guarda de asientos. Se invoca ANTES de invitar o reactivar a un miembro.
 * @throws ConflictError con `details.upgradeRequired` cuando no quedan asientos.
 */
export async function assertSeatAvailable(ctx: RoadGateContext, teamId: string): Promise<void> {
  const row = await readTeamBilling(ctx, teamId);
  const plan = normalizePlan(row.plan);
  const seatLimit = Math.min(row.seat_limit ?? PLAN_CATALOG[plan].maxSeats, PLAN_CATALOG[plan].maxSeats);
  const seatsUsed = await countActiveSeats(ctx, teamId);
  if (seatsUsed >= seatLimit) {
    throw new ConflictError(
      `Seat limit reached (${seatsUsed}/${seatLimit}). Upgrade your plan to add more members.`,
      { upgradeRequired: true, plan, seatLimit, seatsUsed },
    );
  }
}

/** Sólo el Team Admin puede abrir checkout o gestionar la suscripción. */
export async function requireBillingAdmin(ctx: RoadGateContext): Promise<ActiveTeam> {
  const team = await getActiveTeam(ctx);
  if (!team) throw new NotFoundError("Team");
  if (team.role !== "admin") {
    throw new ForbiddenError("Only the team admin can manage the subscription");
  }
  return team;
}
