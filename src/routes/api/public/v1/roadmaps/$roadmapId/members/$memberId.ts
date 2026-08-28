/**
 * =============================================================================
 * REST v1 · Acceso concreto sobre un roadmap (Fase III)
 * =============================================================================
 * PATCH  /api/public/v1/roadmaps/:roadmapId/members/:memberId  { role }
 * DELETE /api/public/v1/roadmaps/:roadmapId/members/:memberId  → retirar acceso
 *
 * Ambas operaciones son exclusivas del Roadmap Admin. Retirar el acceso surte
 * efecto inmediatamente, incluso si el usuario tiene la URL abierta.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/members/$memberId")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      PATCH: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:write");
          const body = (await readJson(request)) as { role?: string };
          return json(
            await core.updateRoadmapMemberRole(ctx, {
              roadmapId: params.roadmapId,
              memberId: params.memberId,
              role: body.role,
            }),
          );
        }),

      DELETE: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:write");
          return json(
            await core.revokeRoadmapMember(ctx, {
              roadmapId: params.roadmapId,
              memberId: params.memberId,
            }),
          );
        }),
    },
  },
});
