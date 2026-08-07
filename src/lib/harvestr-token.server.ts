/**
 * Resuelve el token de Harvestr a usar en una petición: primero la credencial
 * cifrada del usuario, y si no existe, el HARVESTR_TOKEN global del backend.
 * Server-only: descifra secretos.
 */
import { decryptSecret } from "@/lib/integration-crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function resolveHarvestrToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("integration_credentials")
    .select("token_ciphertext")
    .eq("user_id", userId)
    .eq("provider", "harvestr")
    .maybeSingle();

  if (data?.token_ciphertext) {
    try {
      return await decryptSecret(data.token_ciphertext);
    } catch (error) {
      console.error("[Harvestr] could not decrypt stored token", error);
    }
  }

  return process.env["HARVESTR_TOKEN"] ?? null;
}
