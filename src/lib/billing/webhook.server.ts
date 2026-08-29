/**
 * =============================================================================
 * Fase 5 · Procesado de webhooks de suscripción (SERVIDOR)
 * =============================================================================
 * Este módulo es la ÚNICA vía por la que cambian plan, seat_limit y estado de
 * suscripción de un equipo (un trigger de BD lo impide desde la app).
 *
 * Garantías:
 *  - Firma HMAC-SHA256 verificada en tiempo constante con `BILLING_WEBHOOK_SECRET`.
 *  - Idempotencia real: `billing_events(provider, event_id)` es UNIQUE, así que
 *    reenviar el mismo evento no vuelve a aplicar el cambio.
 *  - Nunca desactiva miembros ni borra datos ante un downgrade.
 *
 * El formato del payload es agnóstico del proveedor a propósito: cuando se
 * apruebe uno (Paddle/Stripe) sólo hay que traducir su evento a este DTO.
 */
import { PLAN_CATALOG, normalizePlan, type BillingPlan, type SubscriptionStatus } from "@/core";

export type BillingWebhookPayload = {
  /** Id único del evento en el proveedor: clave de idempotencia. */
  eventId: string;
  eventType: string;
  provider: string;
  teamId: string;
  plan?: BillingPlan | "free";
  seatLimit?: number;
  status?: SubscriptionStatus;
  currentPeriodEnd?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
};

export type WebhookResult = { applied: boolean; reason?: string };

/** Comparación en tiempo constante (sin dependencias de Node). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica `X-Signature: sha256=<hex>` sobre el cuerpo crudo. */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return safeEqual(provided.toLowerCase(), expected);
}

function sanitize(payload: BillingWebhookPayload) {
  const update: Record<string, unknown> = {};
  if (payload.plan) {
    const plan = normalizePlan(payload.plan);
    update["plan"] = plan;
    // El seat_limit nunca puede superar el tope duro del plan.
    const max = PLAN_CATALOG[plan].maxSeats;
    if (typeof payload.seatLimit === "number") {
      update["seat_limit"] = Math.max(1, Math.min(payload.seatLimit, max));
    }
  } else if (typeof payload.seatLimit === "number") {
    update["seat_limit"] = Math.max(1, payload.seatLimit);
  }
  if (payload.status) update["subscription_status"] = payload.status;
  if (payload.currentPeriodEnd !== undefined) update["current_period_end"] = payload.currentPeriodEnd;
  if (payload.customerId !== undefined) update["provider_customer_id"] = payload.customerId;
  if (payload.subscriptionId !== undefined) update["provider_subscription_id"] = payload.subscriptionId;
  update["billing_provider"] = payload.provider;
  return update;
}

/**
 * Aplica el evento de forma idempotente. Se registra PRIMERO en
 * `billing_events`; si la inserción choca con el UNIQUE, el evento ya se
 * procesó y no se toca nada más.
 */
export async function applyBillingWebhook(
  payload: BillingWebhookPayload,
): Promise<WebhookResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error: insertError } = await supabaseAdmin.from("billing_events").insert({
    provider: payload.provider,
    event_id: payload.eventId,
    event_type: payload.eventType,
    team_id: payload.teamId,
    payload: payload as unknown as never,
  });

  if (insertError) {
    // 23505 = unique_violation → reenvío del mismo evento.
    if ((insertError as { code?: string }).code === "23505") {
      return { applied: false, reason: "duplicate_event" };
    }
    console.error("[billing] event log failed:", insertError);
    throw new Error("Could not record the billing event");
  }

  const update = sanitize(payload);
  const { error: updateError } = await supabaseAdmin
    .from("teams")
    .update(update as never)
    .eq("id", payload.teamId);

  if (updateError) {
    console.error("[billing] subscription update failed:", updateError);
    throw new Error("Could not apply the subscription change");
  }

  return { applied: true };
}
