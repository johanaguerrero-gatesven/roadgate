/**
 * =============================================================================
 * REST v1 · Transferencia de Roadmap Admin (Fase III)
 * =============================================================================
 * POST /api/public/v1/roadmaps/:roadmapId/transfer  { teamMemberId }
 *
 * Operación transaccional en base de datos: el nuevo Admin pasa a serlo y el
 * anterior queda como Editor. Nunca hay más de un Admin por roadmap.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/transfer")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      POST: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:write");
          const body = (await readJson(request)) as { teamMemberId?: string };
          return json(
            await core.transferRoadmapAdmin(ctx, {
              roadmapId: params.roadmapId,
              teamMemberId: body.teamMemberId,
            }),
          );
        }),
    },
  },
});
