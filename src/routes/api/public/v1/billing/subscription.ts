/**
 * =============================================================================
 * REST v1 · Estado comercial del equipo activo (Fase 5)
 * =============================================================================
 * GET /api/public/v1/billing/subscription → plan, estado, asientos y límites.
 * La fuente de verdad es la BD: el cliente NO puede alterar plan ni límites.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/billing/subscription")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:read");
          return json(await core.getBillingState(ctx));
        }),
    },
  },
});
