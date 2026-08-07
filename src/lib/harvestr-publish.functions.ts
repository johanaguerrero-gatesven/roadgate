/**
 * =============================================================================
 * Adaptador de salida: publicar un Roadmap completo en Harvestr.io
 * =============================================================================
 * Crea un "roadmap project" en Harvestr por cada Quarter con contenido.
 * El token se resuelve SIEMPRE dentro del handler (credencial cifrada del
 * usuario o HARVESTR_TOKEN global) y nunca viaja al navegador.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const itemSchema = z.object({
  code: z.string().trim().max(60).default(""),
  title: z.string().trim().max(300).default(""),
  type: z.string().trim().max(30).default(""),
  effort: z.number().nullable().optional(),
  priority: z.string().trim().max(40).optional(),
});

const publishSchema = z.object({
  roadmapName: z.string().trim().min(1).max(200),
  /** Nombre del roadmap/grupo destino en Harvestr; se usa como prefijo del título. */
  targetGroup: z.string().trim().max(80).optional(),
  year: z.number().int().min(2000).max(2100),
  quarters: z
    .array(
      z.object({
        quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
        items: z.array(itemSchema).max(500),
      }),
    )
    .min(1)
    .max(4),
});

export type PublishRoadmapInput = z.infer<typeof publishSchema>;

export type PublishRoadmapResult = {
  created: { quarter: string; id: string | null; title: string }[];
  failed: { quarter: string; status: number }[];
};

/** Rango de fechas ISO (inicio/fin) de un quarter natural. */
function quarterRange(year: number, quarter: string): { start: string; end: string } {
  const index = Number(quarter.slice(1)) - 1;
  const start = new Date(Date.UTC(year, index * 3, 1));
  const end = new Date(Date.UTC(year, index * 3 + 3, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export const publishRoadmapToHarvestr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => publishSchema.parse(data))
  .handler(async ({ data, context }): Promise<PublishRoadmapResult> => {
    const { resolveHarvestrToken } = await import("@/lib/harvestr-token.server");
    const token = await resolveHarvestrToken(context.userId);
    if (!token) throw new Error("HARVESTR_TOKEN is not configured");

    const created: PublishRoadmapResult["created"] = [];
    const failed: PublishRoadmapResult["failed"] = [];

    for (const group of data.quarters) {
      if (group.items.length === 0) continue;
      const { start, end } = quarterRange(data.year, group.quarter);
      const prefix = data.targetGroup ? `[${data.targetGroup}] ` : "";
      const title = `${prefix}${data.roadmapName} — ${group.quarter} ${data.year}`;
      const lines = group.items.map((i) => {
        const bits = [i.code, i.title].filter(Boolean).join(" · ");
        const meta = [i.type, i.priority, i.effort != null ? `${i.effort}h` : null]
          .filter(Boolean)
          .join(" | ");
        return meta ? `- ${bits} (${meta})` : `- ${bits}`;
      });

      const payload: Record<string, string> = {
        title,
        caption: `${group.items.length} work items`,
        publicDescription: lines.join("\n").slice(0, 5000),
        roadmapStartDate: start,
        roadmapEndDate: end,
      };

      const response = await fetch("https://rest.harvestr.io/v1/roadmap-projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Harvestr-Private-App-Token": token,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("[Harvestr] publish quarter failed", group.quarter, response.status);
        failed.push({ quarter: group.quarter, status: response.status });
        continue;
      }

      let id: string | null = null;
      try {
        const body = (await response.json()) as Record<string, unknown>;
        const nested = (body["roadmapProject"] ?? body["data"] ?? {}) as Record<string, unknown>;
        id =
          typeof nested["id"] === "string"
            ? (nested["id"] as string)
            : typeof body["id"] === "string"
              ? (body["id"] as string)
              : null;
      } catch {
        id = null;
      }

      created.push({ quarter: group.quarter, id, title });
    }

    return { created, failed };
  });
