/**
 * =============================================================================
 * REST v1 · Webhook de suscripciones (Fase 5)
 * =============================================================================
 * POST /api/public/v1/billing/webhook
 *
 * Única vía de cambio de plan/estado/seat_limit. Requisitos:
 *  - Firma HMAC-SHA256 sobre el cuerpo crudo (`X-Signature: sha256=<hex>`) con
 *    el secreto `BILLING_WEBHOOK_SECRET`. Sin secreto configurado → 503.
 *  - Idempotencia: `billing_events(provider, event_id)` UNIQUE.
 *  - Nunca desactiva miembros ni borra datos ante un downgrade.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  eventId: z.string().min(1).max(200),
  eventType: z.string().min(1).max(120),
  provider: z.string().min(1).max(40),
  teamId: z.string().uuid(),
  plan: z.enum(["free", "solo", "team", "business"]).optional(),
  seatLimit: z.number().int().min(1).max(1000).optional(),
  status: z
    .enum(["trialing", "active", "past_due", "grace_period", "cancelled"])
    .optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  customerId: z.string().max(200).nullable().optional(),
  subscriptionId: z.string().max(200).nullable().optional(),
});

export const Route = createFileRoute("/api/public/v1/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["BILLING_WEBHOOK_SECRET"];
        if (!secret) {
          return new Response(
            JSON.stringify({ error: { code: "provider_not_configured" } }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        const raw = await request.text();
        const { verifyWebhookSignature, applyBillingWebhook } = await import(
          "@/lib/billing/webhook.server"
        );

        const valid = await verifyWebhookSignature(
          raw,
          request.headers.get("x-signature"),
          secret,
        );
        if (!valid) {
          return new Response(JSON.stringify({ error: { code: "invalid_signature" } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let parsed;
        try {
          parsed = payloadSchema.parse(JSON.parse(raw));
        } catch {
          return new Response(JSON.stringify({ error: { code: "invalid_payload" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await applyBillingWebhook(parsed);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[billing] webhook failed:", error);
          return new Response(JSON.stringify({ error: { code: "processing_failed" } }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
