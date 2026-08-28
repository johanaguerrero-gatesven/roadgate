/**
 * =============================================================================
 * REST v1 · Miembros del equipo (Fase II)
 * =============================================================================
 * GET /api/public/v1/teams/members → miembros del equipo activo del actor.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/teams/members/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          return json(await core.listTeamMembers(ctx));
        }),
    },
  },
});
