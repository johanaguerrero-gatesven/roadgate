/**
 * =============================================================================
 * Errores de dominio de RoadGate
 * =============================================================================
 * El core NO conoce HTTP. Para que cualquier adaptador (RPC de TanStack, REST,
 * CLI, workers…) pueda traducir un fallo a su propio protocolo, todos los
 * errores del dominio heredan de `DomainError` y llevan:
 *
 *  - `code`   → identificador estable y legible por máquina (p. ej. `not_found`).
 *              Es lo que consumirá un cliente externo de la API, así que NUNCA
 *              debe cambiar sin versionar.
 *  - `status` → equivalente HTTP sugerido. Vive aquí (y no en la capa REST)
 *              únicamente como *hint*; el core sigue sin importar nada de HTTP.
 *  - `details`→ información adicional opcional (p. ej. errores de validación).
 *
 * De este modo la Fase 2 (API REST) podrá hacer un único `toErrorResponse(err)`
 * en lugar de mapear mensajes de texto a mano.
 */

/** Códigos de error estables expuestos por el core (contrato público). */
export type DomainErrorCode =
  | "unauthorized"      // No hay sesión válida.
  | "forbidden"         // Hay sesión, pero el recurso no es del usuario.
  | "not_found"         // El recurso no existe (o no es visible para el usuario).
  | "validation_error"  // La entrada no cumple el esquema.
  | "conflict"          // Estado incompatible (duplicados, invariantes rotos).
  | "storage_error";    // Fallo de la capa de persistencia (Postgres/PostgREST).

/** Error base del dominio. Todos los servicios lanzan subclases de esta. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** El recurso solicitado no existe o el usuario no puede verlo. */
export class NotFoundError extends DomainError {
  constructor(resource = "Resource") {
    super("not_found", `${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

/** El usuario está autenticado pero el recurso pertenece a otra cuenta. */
export class ForbiddenError extends DomainError {
  constructor(message = "You do not have access to this resource") {
    super("forbidden", message, 403);
    this.name = "ForbiddenError";
  }
}

/** No hay sesión / token válido. */
export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401);
    this.name = "UnauthorizedError";
  }
}

/** La entrada no cumple el esquema Zod o una regla de negocio de forma. */
export class ValidationError extends DomainError {
  constructor(message = "Invalid input", details?: unknown) {
    super("validation_error", message, 400, details);
    this.name = "ValidationError";
  }
}

/** Conflicto de estado: duplicados, invariantes de jerarquía rotos, etc. */
export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super("conflict", message, 409, details);
    this.name = "ConflictError";
  }
}

/**
 * Fallo de la capa de persistencia. Envolvemos el mensaje del driver para no
 * filtrar detalles internos al cliente pero conservarlos en `details` (que la
 * capa REST puede decidir NO serializar en producción).
 */
export class StorageError extends DomainError {
  /** Detalle interno del driver: SOLO para logs de servidor, nunca se serializa. */
  readonly internalDetails?: unknown;

  constructor(message: string, internalDetails?: unknown) {
    // `details` queda deliberadamente vacío: la capa REST serializa `details`,
    // y el error crudo de Postgres/PostgREST filtraría tablas, columnas y
    // restricciones internas al cliente.
    super("storage_error", message, 500);
    this.name = "StorageError";
    this.internalDetails = internalDetails;
  }
}

/**
 * Helper usado por todos los servicios: convierte el `{ data, error }` de
 * Supabase en una excepción de dominio o devuelve los datos.
 * Centralizarlo evita repetir `if (error) throw new Error(error.message)` y
 * garantiza que un fallo de BD nunca escape como `Error` genérico.
 */
export function unwrap<T>(
  result: { data: T; error: { message: string } | null },
  context: string,
): T {
  if (result.error) {
    // El mensaje del driver se registra en servidor pero no viaja al cliente.
    console.error(`[storage] ${context}:`, result.error);
    throw new StorageError("A storage operation failed", result.error);
  }
  return result.data;
}
