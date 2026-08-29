/**
 * =============================================================================
 * REST v1 · Apertura de checkout (Fase 5)
 * =============================================================================
 * POST /api/public/v1/billing/checkout
 *
 * SÓLO el Team Admin puede invocarlo (validado en servidor, nunca en cliente).
 * Todavía no hay proveedor de pagos aprobado, así que responde 501 con un
 * código estable; cuando se apruebe Paddle o Stripe, únicamente hay que crear
 * aquí la sesión de pago y devolver su URL.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/billing/checkout")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      POST: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:write");
          // Autorización de servidor: un miembro no Admin recibe 403 aquí.
          await core.requireBillingAdmin(ctx);
          return json(
            {
              error: {
                code: "provider_not_configured",
                message:
                  "No payment provider has been approved yet. Contact the workspace owner.",
              },
            },
            501,
          );
        }),
    },
  },
});
