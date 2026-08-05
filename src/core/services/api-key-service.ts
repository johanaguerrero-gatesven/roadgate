/**
 * =============================================================================
 * Caso de uso: API keys de integración (Fase 4)
 * =============================================================================
 * Permite que un usuario de RoadGate emita credenciales de larga duración para
 * que sistemas externos consuman `/api/public/v1/*` sin una sesión de navegador.
 *
 * Diseño de seguridad:
 *  - La clave en claro (`rg_live_<32 bytes hex>`) se muestra UNA SOLA VEZ, al
 *    crearla. En la base de datos sólo se guarda su SHA-256 (`key_hash`), por
 *    lo que ni un volcado de la tabla permite reconstruirla.
 *  - `prefix` (los primeros caracteres) se guarda en claro sólo para que el
 *    usuario reconozca la clave en el listado (`rg_live_1a2b…`).
 *  - Cada clave lleva `scopes`: hoy `roadmaps:read` y `roadmaps:write`. El
 *    adaptador REST comprueba el scope antes de ejecutar el caso de uso.
 *  - Revocar no borra: marca `revoked_at`, para conservar la traza.
 *
 * Nota: el hash usa Web Crypto (`crypto.subtle`), disponible tanto en el
 * runtime serverless como en Node moderno; no se importa nada de Node aquí.
 */
import type { RoadGateContext, RoadGateDb } from "../context";
import { unwrap, ValidationError, NotFoundError, UnauthorizedError } from "../errors";
import { z } from "zod";
import { parseInput, uuidSchema } from "../schemas";

/** Scopes soportados por la API pública v1. */
export const API_SCOPES = ["roadmaps:read", "roadmaps:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Prefijo de todas las claves emitidas. Sirve para detectarlas en el header. */
export const API_KEY_PREFIX = "rg_live_";

export const createApiKeyInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  scopes: z.array(z.enum(API_SCOPES)).min(1).default(["roadmaps:read"]),
  /** Días de validez; si se omite, la clave no caduca. */
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

export const revokeApiKeyInput = z.object({ keyId: uuidSchema });

/** Vista segura de una clave: nunca incluye el secreto. */
export type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

function toSummary(row: {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

/** SHA-256 en hexadecimal de la clave en claro. */
export async function hashApiKey(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Genera una clave aleatoria criptográficamente segura. */
function generateRawKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${API_KEY_PREFIX}${hex}`;
}

/** Lista las claves del actor (sin secretos), las más recientes primero. */
export async function listApiKeys(ctx: RoadGateContext): Promise<ApiKeySummary[]> {
  const rows = unwrap(
    await ctx.db
      .from("api_keys")
      .select("id,name,prefix,scopes,created_at,last_used_at,expires_at,revoked_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false }),
    "listApiKeys",
  );
  return (rows ?? []).map(toSummary);
}

/**
 * Crea una clave y devuelve el secreto EN CLARO junto al resumen.
 * El llamante debe mostrarlo una única vez: no hay forma de recuperarlo.
 */
export async function createApiKey(
  ctx: RoadGateContext,
  input: unknown,
): Promise<{ key: string; apiKey: ApiKeySummary }> {
  const { name, scopes, expiresInDays } = parseInput(createApiKeyInput, input);

  const raw = generateRawKey();
  const keyHash = await hashApiKey(raw);
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  const row = unwrap(
    await ctx.db
      .from("api_keys")
      .insert({
        user_id: ctx.userId,
        name,
        // Prefijo visible: `rg_live_` + 8 caracteres del cuerpo.
        prefix: raw.slice(0, API_KEY_PREFIX.length + 8),
        key_hash: keyHash,
        scopes,
        expires_at: expiresAt,
      })
      .select("id,name,prefix,scopes,created_at,last_used_at,expires_at,revoked_at")
      .single(),
    "createApiKey",
  );

  return { key: raw, apiKey: toSummary(row) };
}

/** Revoca (no borra) una clave del actor. */
export async function revokeApiKey(ctx: RoadGateContext, input: unknown): Promise<{ ok: true }> {
  const { keyId } = parseInput(revokeApiKeyInput, input);
  const row = unwrap(
    await ctx.db
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId)
      .eq("user_id", ctx.userId)
      .select("id")
      .maybeSingle(),
    "revokeApiKey",
  );
  if (!row) throw new NotFoundError("API key");
  return { ok: true };
}

/** Borra definitivamente una clave del actor. */
export async function deleteApiKey(ctx: RoadGateContext, input: unknown): Promise<{ ok: true }> {
  const { keyId } = parseInput(revokeApiKeyInput, input);
  unwrap(
    await ctx.db.from("api_keys").delete().eq("id", keyId).eq("user_id", ctx.userId).select("id"),
    "deleteApiKey",
  );
  return { ok: true };
}

/**
 * Resuelve una clave en claro a su dueño y scopes.
 * Se ejecuta con un cliente privilegiado (service role) porque en este punto
 * todavía NO hay identidad: es precisamente lo que estamos resolviendo.
 * @throws UnauthorizedError si la clave no existe, está revocada o caducada.
 */
export async function resolveApiKey(
  db: RoadGateDb,
  raw: string,
): Promise<{ userId: string; scopes: string[]; keyId: string }> {
  if (!raw.startsWith(API_KEY_PREFIX)) throw new ValidationError("Not an API key");

  const keyHash = await hashApiKey(raw);
  const { data, error } = await db
    .from("api_keys")
    .select("id,user_id,scopes,revoked_at,expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) throw new UnauthorizedError("Invalid API key");
  if (!data) throw new UnauthorizedError("Invalid API key");
  if (data.revoked_at) throw new UnauthorizedError("API key has been revoked");
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new UnauthorizedError("API key has expired");
  }

  // Traza de uso (best-effort: un fallo aquí no debe tumbar la petición).
  void db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return { userId: data.user_id, scopes: data.scopes ?? [], keyId: data.id };
}
