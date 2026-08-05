/**
 * =============================================================================
 * REST v1 · Colección de API keys (Fase 4)
 * =============================================================================
 * GET  /api/public/v1/api-keys → lista las claves del actor (sin secretos)
 * POST /api/public/v1/api-keys → emite una clave nueva
 *      body: { name: string, scopes?: string[], expiresInDays?: number }
 *      resp: { key: "rg_live_…", apiKey: { … } }  ← el secreto se ve UNA vez
 *
 * Sólo accesible con sesión de la aplicación: una API key no puede emitir
 * otras claves (evita la escalada de privilegios de una credencial filtrada).
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/api-keys/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          return json(await core.listApiKeys(ctx));
        }),

      POST: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const body = await readJson(request);
          return json(await core.createApiKey(ctx, body), 201);
        }),
    },
  },
});
