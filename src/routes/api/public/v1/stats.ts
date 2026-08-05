/**
 * =============================================================================
 * REST v1 · Métricas del workspace
 * =============================================================================
 * GET /api/public/v1/stats[?roadmapId=<uuid>]
 *
 * Sin `roadmapId` agrega los items de todos los roadmaps del actor; con él,
 * acota el desglose a ese roadmap. `roadmapsCount` es siempre global (es una
 * métrica del espacio, no del roadmap seleccionado).
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/stats")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:read");
          const roadmapId = new URL(request.url).searchParams.get("roadmapId");
          return json(await core.getWorkspaceStats(ctx, { roadmapId }));
        }),
    },
  },
});
