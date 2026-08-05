/**
 * =============================================================================
 * REST v1 · Histórico de capacidad (audit trail)
 * =============================================================================
 * GET /api/public/v1/roadmaps/:roadmapId/capacity/history
 *
 * Devuelve los 200 cambios más recientes (quién, cuándo, valor anterior y
 * nuevo). Sólo lectura: los apuntes los escribe el propio core al guardar la
 * capacidad, nunca un cliente externo.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/capacity/history")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:read");
          return json(await core.listCapacityHistory(ctx, { roadmapId: params.roadmapId }));
        }),
    },
  },
});
