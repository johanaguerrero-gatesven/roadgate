/**
 * =============================================================================
 * REST v1 · Especificación OpenAPI (Fase 5)
 * =============================================================================
 * GET /api/public/v1/openapi.json → contrato completo de la API.
 *
 * Endpoint deliberadamente ANÓNIMO: la especificación es documentación pública
 * (no contiene datos de usuario) y así cualquier cliente OpenAPI —Postman,
 * Insomnia, generadores de SDK— puede descargarla sin credenciales.
 */
import { createFileRoute } from "@tanstack/react-router";
import { openApiDocument } from "@/lib/rest/openapi";
import { preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async () =>
        new Response(JSON.stringify(openApiDocument, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
