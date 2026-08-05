/**
 * =============================================================================
 * REST v1 · API key concreta (Fase 4)
 * =============================================================================
 * DELETE /api/public/v1/api-keys/:keyId            → revoca (marca revoked_at)
 * DELETE /api/public/v1/api-keys/:keyId?purge=true → borra la fila por completo
 *
 * Igual que la colección: sólo con sesión de la aplicación.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/api-keys/$keyId")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      DELETE: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const purge = new URL(request.url).searchParams.get("purge") === "true";
          const input = { keyId: params.keyId };
          return json(
            purge ? await core.deleteApiKey(ctx, input) : await core.revokeApiKey(ctx, input),
          );
        }),
    },
  },
});
