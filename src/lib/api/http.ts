/**
 * =============================================================================
 * Cliente HTTP del SDK de RoadGate (Fase 3)
 * =============================================================================
 * El frontend deja de hablar por RPC y pasa a consumir EXACTAMENTE la misma
 * API pública que un integrador externo: `/api/public/v1/*`.
 *
 * Responsabilidades de este módulo (y sólo estas):
 *   1. Resolver la base URL de la API.
 *   2. Adjuntar el bearer token de la sesión de Supabase en cada llamada.
 *   3. Traducir el contrato de error `{ error: { code, message } }` a una
 *      excepción `ApiError` tipada que las pantallas pueden inspeccionar.
 *
 * No contiene lógica de negocio: eso vive en `src/core/` detrás de la API.
 */
import { supabase } from "@/integrations/supabase/client";

/** Prefijo público de la API v1. Mismo contrato para frontend y terceros. */
export const API_BASE = "/api/public/v1";

/** Error de la API con el `code` estable del contrato (`not_found`, ...). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Devuelve el access token de la sesión actual, o null si no hay sesión. */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Cuerpo JSON; se serializa automáticamente. */
  body?: unknown;
  /** Query params; los valores `null`/`undefined` se omiten. */
  query?: Record<string, string | null | undefined>;
};

/**
 * Ejecuta una llamada autenticada contra la API v1 y devuelve el DTO ya
 * parseado. Lanza `ApiError` en cualquier respuesta no 2xx.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, "unauthorized", "No active session");

  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  const payload = text.trim() ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "internal_error",
      err?.message ?? `Request failed with status ${response.status}`,
      err?.details,
    );
  }

  return payload as T;
}
