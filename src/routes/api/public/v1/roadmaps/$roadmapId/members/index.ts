/**
 * =============================================================================
 * REST v1 · Miembros de un roadmap (Fase III)
 * =============================================================================
 * GET  /api/public/v1/roadmaps/:roadmapId/members            → quién tiene acceso
 * GET  /api/public/v1/roadmaps/:roadmapId/members?candidates=1
 *      → miembros activos del equipo con los que aún se puede compartir (Admin)
 * POST /api/public/v1/roadmaps/:roadmapId/members            → compartir
 *      body: { teamMemberId: uuid, role: "editor" | "viewer" }
 *
 * La autorización (Admin / Editor / Viewer) la resuelve el core y la refuerza
 * RLS: un Viewer que llame directamente aquí recibe 403.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as core from "@/core";
import { createRestContext, requireScope } from "@/lib/rest/context";
import { handle, json, preflight, readJson } from "@/lib/rest/respond";

export const Route = createFileRoute("/api/public/v1/roadmaps/$roadmapId/members/")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),

      GET: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:read");
          const url = new URL(request.url);
          if (url.searchParams.get("candidates") === "1") {
            return json(await core.listShareCandidates(ctx, { roadmapId: params.roadmapId }));
          }
          return json(await core.listRoadmapMembers(ctx, { roadmapId: params.roadmapId }));
        }),

      POST: async ({ request, params }) =>
        handle(async () => {
          const ctx = await createRestContext(request);
          requireScope(ctx, "roadmaps:write");
          const body = (await readJson(request)) as { teamMemberId?: string; role?: string };
          return json(
            await core.shareRoadmap(ctx, {
              roadmapId: params.roadmapId,
              teamMemberId: body.teamMemberId,
              role: body.role,
            }),
          );
        }),
    },
  },
});
