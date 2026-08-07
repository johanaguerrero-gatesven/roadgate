/**
 * =============================================================================
 * Credenciales de integraciones (guardar / consultar / borrar)
 * =============================================================================
 * El token se cifra en el servidor (AES-256-GCM) antes de guardarse y NUNCA
 * vuelve al navegador: al cliente sólo se le devuelve una pista enmascarada.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PROVIDER = "harvestr";

const saveTokenSchema = z.object({
  token: z.string().trim().min(10, "Token is too short").max(500),
});

export type IntegrationCredentialStatus = {
  configured: boolean;
  hint: string | null;
  updatedAt: string | null;
  /** true si existe un HARVESTR_TOKEN global en el entorno del backend. */
  envFallback: boolean;
};

export const getHarvestrTokenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationCredentialStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("token_hint,updated_at")
      .eq("user_id", context.userId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (error) throw new Error("Could not read the integration status");

    return {
      configured: Boolean(data),
      hint: data?.token_hint ?? null,
      updatedAt: data?.updated_at ?? null,
      envFallback: Boolean(process.env["HARVESTR_TOKEN"]),
    };
  });

export const saveHarvestrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveTokenSchema.parse(data))
  .handler(async ({ data, context }): Promise<IntegrationCredentialStatus> => {
    const { encryptSecret, maskSecret } = await import("@/lib/integration-crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ciphertext = await encryptSecret(data.token);
    const hint = maskSecret(data.token);

    const { data: row, error } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(
        {
          user_id: context.userId,
          provider: PROVIDER,
          token_ciphertext: ciphertext,
          token_hint: hint,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      )
      .select("token_hint,updated_at")
      .single();

    if (error || !row) throw new Error("Could not save the token");

    return {
      configured: true,
      hint: row.token_hint,
      updatedAt: row.updated_at,
      envFallback: Boolean(process.env["HARVESTR_TOKEN"]),
    };
  });

export const deleteHarvestrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationCredentialStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider", PROVIDER);

    if (error) throw new Error("Could not delete the token");

    return {
      configured: false,
      hint: null,
      updatedAt: null,
      envFallback: Boolean(process.env["HARVESTR_TOKEN"]),
    };
  });

export type TestConnectionResult = {
  ok: boolean;
  /** Código HTTP devuelto por el proveedor (0 si la petición ni siquiera salió). */
  status: number;
  /** Motivo legible, sin datos del proveedor ni del secreto. */
  reason: "ok" | "missing" | "unauthorized" | "error";
};

/**
 * Comprueba el token contra la API de Harvestr con una lectura inocua.
 * Nunca devuelve el secreto ni el cuerpo crudo del proveedor.
 */
export const testHarvestrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestConnectionResult> => {
    const { resolveHarvestrToken } = await import("@/lib/harvestr-token.server");
    const token = await resolveHarvestrToken(context.userId);
    if (!token) return { ok: false, status: 0, reason: "missing" };

    try {
      const response = await fetch("https://rest.harvestr.io/v1/roadmap-projects?limit=1", {
        method: "GET",
        headers: { "X-Harvestr-Private-App-Token": token },
      });

      if (response.ok) return { ok: true, status: response.status, reason: "ok" };
      if (response.status === 401 || response.status === 403) {
        return { ok: false, status: response.status, reason: "unauthorized" };
      }
      return { ok: false, status: response.status, reason: "error" };
    } catch (error) {
      console.error("[Harvestr] connection test failed", error);
      return { ok: false, status: 0, reason: "error" };
    }
  });
