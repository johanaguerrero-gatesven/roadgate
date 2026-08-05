/**
 * =============================================================================
 * REST v1 · Recurso roadmap
 * =============================================================================
 * GET    /api/public/v1/roadmaps/:roadmapId  → cabecera + items + capacidad
 * PATCH  /api/public/v1/roadmaps/:roadmapId  → renombrar  { name: string }
 * DELETE /api/public/v1/roadmaps/:roadmapId  → borrar (cascada de items/capacidad)
 *
 * Si el roadmap no existe o es de otra cuenta, el core lanza `NotFoundError` y
 * el adaptador responde 404 (no se distingue entre ambos casos: evita que un
 * tercero pueda enumerar ids ajenos).
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          return json(await core.getRoadmap(ctx, { roadmapId: params.roadmapId }));
        }),

      PATCH: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          const body = (await readJson(request)) as { name?: string };
          return json(
            await core.renameRoadmap(ctx, { roadmapId: params.roadmapId, name: body.name }),
          );
        }),

      DELETE: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          return json(await core.deleteRoadmap(ctx, { roadmapId: params.roadmapId }));
        }),
    },
  },
});
