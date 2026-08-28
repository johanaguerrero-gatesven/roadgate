/**
 * =============================================================================
 * REST v1 · Equipo activo del actor
 * =============================================================================
 * GET /api/public/v1/teams/me → equipo activo (se provisiona si aún no existe)
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/teams/me")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:read");
          return json(await core.ensureActiveTeam(ctx));
        }),
    },
  },
});
