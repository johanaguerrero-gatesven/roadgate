/**
 * =============================================================================
 * REST v1 · Work items de un roadmap
 * =============================================================================
 * GET /api/public/v1/roadmaps/:roadmapId/items → lista de work items
 * PUT /api/public/v1/roadmaps/:roadmapId/items → reemplaza TODOS los items
 *                                                { items: RoadmapItem[] }
 *
 * `PUT` (no `POST`) porque la semántica es de reemplazo total del conjunto: el
 * cuerpo enviado pasa a ser el estado completo del roadmap. Es idempotente y
 * encaja con cómo el editor guarda su snapshot. La edición item a item llegará
 * cuando haya un caso de uso real que la necesite.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/items")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          return json(await core.listItems(ctx, { roadmapId: params.roadmapId }));
        }),

      PUT: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          const body = (await readJson(request)) as { items?: unknown };
          return json(
            await core.replaceItems(ctx, {
              roadmapId: params.roadmapId,
              items: body.items ?? [],
            }),
          );
        }),
    },
  },
});
