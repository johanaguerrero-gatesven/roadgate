/**
 * =============================================================================
 * Adaptador REST: autenticación y construcción del contexto del core
 * =============================================================================
 * La API pública de RoadGate vive bajo `/api/public/v1/*`. Ese prefijo evita la
 * protección de sitio del hosting, así que CADA handler debe autenticar por su
 * cuenta — es exactamente lo que hace este módulo.
 *
 * Autenticación soportada hoy:
 *   Authorization: Bearer <access_token de la sesión de RoadGate>
 *
 * En la Fase 4 se añadirán API keys de larga duración (`rg_live_...`) con
 * scopes; el resto de la API no cambiará porque todo desemboca en el mismo
 * `RoadGateContext`.
 *
 * Nota de implementación: el cliente Supabase se crea con la clave publicable
 * y el token del usuario, por lo que RLS aplica como ese usuario. Nunca se usa
 * la service role aquí.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { UnauthorizedError, type RoadGateContext } from "@/core";

/** ¿Es una API key opaca del formato nuevo (no un JWT)? */
function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * `fetch` a medida para Supabase: las claves nuevas son cadenas opacas, no
 * bearers, así que hay que enviarlas en la cabecera `apikey` y quitar el
 * `Authorization` que el SDK añade por defecto (si no, PostgREST responde
 * "Expected 3 parts in JWT").
 */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isOpaqueApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Verifica las credenciales de la petición y devuelve el contexto del core.
 *
 * Dos esquemas de autenticación, ambos por `Authorization: Bearer <…>`:
 *   1. JWT de la sesión de RoadGate  → cliente con la clave publicable y el
 *      token del usuario, por lo que RLS actúa como ese usuario. Scopes: todos.
 *   2. API key de integración (`rg_live_…`, Fase 4) → se resuelve su dueño con
 *      un cliente privilegiado y el contexto queda acotado a ese `userId` y a
 *      los scopes con los que se emitió la clave. RLS no aplica aquí, pero
 *      TODOS los servicios del core filtran por `user_id` de forma explícita.
 *
 * @throws UnauthorizedError si falta la cabecera, el esquema no es Bearer o la
 *         credencial no es válida. El handler lo traduce a 401.
 */
export async function createRestContext(request: Request): Promise<RoadGateContext> {
  // Las variables de entorno se leen AQUÍ (dentro del handler) y no a nivel de
  // módulo: en el runtime serverless se inyectan por petición.
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment configuration");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new UnauthorizedError("Missing Authorization header");
  if (!authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Only Bearer tokens are supported");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new UnauthorizedError("Missing credentials");

  // --- Camino 2: API key de integración --------------------------------------
  if (token.startsWith(API_KEY_PREFIX)) {
    // Se carga dentro del handler para que el módulo server-only no entre en el
    // grafo del bundle de cliente.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resolved = await resolveApiKey(supabaseAdmin, token);
    return {
      db: supabaseAdmin,
      userId: resolved.userId,
      email: null,
      scopes: resolved.scopes,
      authMethod: "api_key",
    };
  }

  // --- Camino 1: sesión de usuario (JWT) -------------------------------------
  if (token.split(".").length !== 3) throw new UnauthorizedError("Invalid access token");

  const db = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new UnauthorizedError("Invalid access token");

  return {
    db,
    userId: data.claims.sub,
    email: (data.claims as { email?: string }).email ?? null,
    scopes: [...API_SCOPES],
    authMethod: "session",
  };
}

/**
 * Comprueba que el contexto tiene el permiso necesario.
 * Una sesión de usuario siempre lo tiene; una API key sólo si se emitió con él.
 * @throws ForbiddenError (403) si el scope no está concedido.
 */
export function requireScope(ctx: RoadGateContext, scope: ApiScope): void {
  if (ctx.authMethod !== "api_key") return;
  if (!ctx.scopes?.includes(scope)) {
    throw new ForbiddenError(`Missing required scope: ${scope}`);
  }
}

/**
 * Endpoints que sólo pueden usarse con una sesión de la aplicación (p. ej. la
 * gestión de API keys): una API key no puede emitir ni revocar otras claves.
 */
export function requireSession(ctx: RoadGateContext): void {
  if (ctx.authMethod === "api_key") {
    throw new ForbiddenError("This endpoint requires a user session, not an API key");
  }
}
