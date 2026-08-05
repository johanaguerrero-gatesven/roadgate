/**
 * =============================================================================
 * REST v1 · Colección de roadmaps
 * =============================================================================
 * GET  /api/public/v1/roadmaps  → lista los roadmaps del actor con su nº de items
 * POST /api/public/v1/roadmaps  → crea un roadmap  { name?: string }
 *
 * El handler es un adaptador fino: autentica, delega en el core y serializa.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          return json(await core.listRoadmaps(ctx));
        }),

      POST: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          const body = await readJson(request);
          // 201 Created: el cuerpo devuelve el id para construir la URL del recurso.
          return json(await core.createRoadmap(ctx, body), 201);
        }),
    },
  },
});
