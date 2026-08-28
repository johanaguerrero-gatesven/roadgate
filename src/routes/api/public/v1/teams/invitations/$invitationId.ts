/**
 * =============================================================================
 * REST v1 · Invitación concreta (Fase II)
 * =============================================================================
 * POST   /api/public/v1/teams/invitations/:id  → reenvía (rota token y caducidad)
 * DELETE /api/public/v1/teams/invitations/:id  → revoca
 *
 * Sólo Team Admin (core + RLS).
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";
import { buildInvitationUrl, sendInvitationEmail } from "@/lib/rest/invitation-email.server";

export const Route = createFileRoute("/api/public/v1/teams/invitations/$invitationId")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      POST: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const team = await core.ensureActiveTeam(ctx);
          const { invitation, token } = await core.resendInvitation(ctx, {
            invitationId: params.invitationId,
          });

          const inviteUrl = buildInvitationUrl(request, token);
          const email = await sendInvitationEmail({
            to: invitation.email,
            inviteUrl,
            teamName: team.name,
            invitedByEmail: ctx.email ?? null,
          });

          return json({ invitation, emailSent: email.sent, inviteUrl });
        }),

      DELETE: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          return json(await core.revokeInvitation(ctx, { invitationId: params.invitationId }));
        }),
    },
  },
});
