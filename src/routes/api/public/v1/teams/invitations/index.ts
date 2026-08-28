/**
 * =============================================================================
 * REST v1 · Invitaciones del equipo (Fase II)
 * =============================================================================
 * GET  /api/public/v1/teams/invitations → invitaciones del equipo (sólo Admin)
 * POST /api/public/v1/teams/invitations → invita por email (sólo Admin)
 *
 * El token en claro nunca se guarda: se usa aquí para el email y para devolver
 * el enlace al Admin cuando el envío de correo no está configurado.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";
import { buildInvitationUrl, sendInvitationEmail } from "@/lib/rest/invitation-email.server";

export const Route = createFileRoute("/api/public/v1/teams/invitations/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          return json(await core.listTeamInvitations(ctx));
        }),

      POST: async ({ request }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const body = (await request.json()) as { email?: string };
          const team = await core.ensureActiveTeam(ctx);
          const { invitation, token } = await core.inviteMember(ctx, { email: body.email });

          const inviteUrl = buildInvitationUrl(request, token);
          const email = await sendInvitationEmail({
            to: invitation.email,
            inviteUrl,
            teamName: team.name,
            invitedByEmail: ctx.email ?? null,
          });

          // El enlace sólo se devuelve al Admin autenticado que acaba de invitar.
          return json({ invitation, emailSent: email.sent, inviteUrl }, 201);
        }),
    },
  },
});
