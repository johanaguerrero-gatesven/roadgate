/**
 * =============================================================================
 * Adaptador REST: respuestas, errores y CORS
 * =============================================================================
 * Normaliza la forma de TODAS las respuestas de `/api/public/v1/*` para que un
 * integrador externo pueda programar contra un contrato estable:
 *
 *   Éxito → 200/201 con el DTO del core tal cual.
 *   Error → `{ "error": { "code": "not_found", "message": "..." } }`
 *
 * `code` procede de `DomainError` (ver `src/core/errors.ts`) y forma parte del
 * contrato público: no debe cambiarse sin versionar la API.
 */
import { DomainError } from "@/core";

/** Cabeceras CORS: la API está pensada para ser consumida desde otros orígenes. */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

/** Respuesta JSON de éxito con CORS y sin caché (los datos son por usuario). */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

/** Respuesta al preflight CORS. Todo endpoint expone un handler `OPTIONS`. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Traduce cualquier excepción a la respuesta de error del contrato.
 * - `DomainError` → su `status` y su `code` (incluye detalles de validación).
 * - Cualquier otra → 500 genérico; el detalle se registra en el servidor y
 *   NO se devuelve al cliente para no filtrar internals.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.status,
    );
  }
  console.error("[api/v1] unhandled error:", error);
  return json({ error: { code: "internal_error", message: "Internal server error" } }, 500);
}

/**
 * Envoltorio de todos los handlers: crea el contexto, ejecuta el caso de uso y
 * centraliza el manejo de errores. Evita repetir try/catch en cada endpoint.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Lee y parsea el cuerpo JSON de la petición.
 * Devuelve `{}` si no hay cuerpo, para que los endpoints con payload opcional
 * (p. ej. crear roadmap sin nombre) funcionen sin condicionales extra.
 */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
