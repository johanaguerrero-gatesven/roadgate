/**
 * =============================================================================
 * REST v1 · Actividad administrativa del equipo (Fase 4)
 * =============================================================================
 * GET /api/public/v1/teams/audit-events?limit=100
 *
 * Solo Team Admin (comprobado en el core y reforzado por RLS). Los eventos
 * siempre están acotados al `team_id` del actor.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/teams/audit-events")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const url = new URL(request.url);
          const raw = url.searchParams.get("limit");
          const limit = raw ? Number(raw) : undefined;
          return json(
            await core.listAuditEvents(ctx, {
              limit: Number.isFinite(limit) ? (limit as number) : undefined,
            }),
          );
        }),
    },
  },
});
