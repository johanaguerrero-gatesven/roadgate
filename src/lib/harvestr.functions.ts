/**
 * =============================================================================
 * Adaptador de salida: Harvestr.io (REST)
 * =============================================================================
 * Crea un "roadmap project" en Harvestr desde los datos de un formulario.
 * El token privado (HARVESTR_TOKEN) se lee SIEMPRE dentro del handler para que
 * nunca viaje al bundle del navegador.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Must be a valid ISO-8601 date");

const createHarvestrRoadmapSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  caption: z.string().trim().max(500).optional(),
  publicDescription: z.string().trim().max(5000).optional(),
  roadmapStartDate: isoDate.optional(),
  roadmapEndDate: isoDate.optional(),
});

export type CreateHarvestrRoadmapInput = z.infer<typeof createHarvestrRoadmapSchema>;

export type CreateHarvestrRoadmapResult = {
  id: string | null;
  title: string;
};

export const createHarvestrRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createHarvestrRoadmapSchema.parse(data))
  .handler(async ({ data }): Promise<CreateHarvestrRoadmapResult> => {
    const token = process.env["HARVESTR_TOKEN"];
    if (!token) {
      throw new Error("HARVESTR_TOKEN is not configured");
    }

    const payload: Record<string, string> = { title: data.title };
    if (data.caption) payload["caption"] = data.caption;
    if (data.publicDescription) payload["publicDescription"] = data.publicDescription;
    if (data.roadmapStartDate) payload["roadmapStartDate"] = data.roadmapStartDate;
    if (data.roadmapEndDate) payload["roadmapEndDate"] = data.roadmapEndDate;

    const response = await fetch("https://rest.harvestr.io/v1/roadmap-projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Harvestr-Private-App-Token": token,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      // No propagamos el cuerpo crudo del proveedor al cliente.
      console.error("[Harvestr] create roadmap failed", response.status, text);
      throw new Error(`Harvestr responded with ${response.status}`);
    }

    const record = (body ?? {}) as Record<string, unknown>;
    const nested = (record["data"] ?? {}) as Record<string, unknown>;
    const id =
      typeof record["id"] === "string"
        ? record["id"]
        : typeof nested["id"] === "string"
          ? (nested["id"] as string)
          : null;

    return { id, title: data.title };
  });
