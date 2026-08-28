/**
 * =============================================================================
 * REST v1 · Aceptar invitación (Fase II)
 * =============================================================================
 * POST /api/public/v1/teams/invitations/accept  { token }
 *
 * Requiere sesión: el invitado puede haber creado la cuenta ahora o tenerla ya.
 * La validación (caducidad, revocación, uso previo, email) ocurre en la función
 * SQL `accept_team_invitation`, y la operación es idempotente.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/teams/invitations/accept")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      POST: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const body = (await request.json()) as { token?: string };
          return json(await core.acceptInvitation(ctx, { token: body.token }));
        }),
    },
  },
});
