/**
 * =============================================================================
 * REST v1 · Miembro concreto (Fase II)
 * =============================================================================
 * PATCH /api/public/v1/teams/members/:memberId  { status: "active"|"inactive" }
 *
 * Sólo Team Admin (comprobado en el core y reforzado por RLS). Desactivar
 * retira el acceso al instante, pero no borra roadmaps ni datos.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireSession } from "@/lib/rest/context";
import { handle, json, preflight } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/teams/members/$memberId")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      PATCH: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireSession(ctx);
          const body = (await request.json()) as { status?: string };
          return json(
            await core.setMemberStatus(ctx, { memberId: params.memberId, status: body.status }),
          );
        }),
    },
  },
});
