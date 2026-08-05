/**
 * =============================================================================
 * REST v1 · Capacidad de un roadmap
 * =============================================================================
 * GET /api/public/v1/roadmaps/:roadmapId/capacity → configuración de capacidad
 * PUT /api/public/v1/roadmaps/:roadmapId/capacity → guarda la configuración
 *                                                   { capacity: CapacityConfig }
 *
 * Cada `PUT` genera automáticamente los apuntes de audit trail de los campos
 * que hayan cambiado (lo hace el core, no este adaptador).
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/capacity/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:read");
          return json(await core.getCapacity(ctx, { roadmapId: params.roadmapId }));
        }),

      PUT: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:write");
          const body = (await readJson(request)) as { capacity?: unknown };
          return json(
            await core.saveCapacity(ctx, {
              roadmapId: params.roadmapId,
              capacity: body.capacity,
            }),
          );
        }),
    },
  },
});
