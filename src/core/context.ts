/**
 * =============================================================================
 * Puertos del core (arquitectura hexagonal)
 * =============================================================================
 * El core define QUÉ necesita para trabajar, no CÓMO se le proporciona. Todos
 * los servicios reciben un `RoadGateContext` como primer argumento:
 *
 *      servicio(ctx, input) -> Promise<DTO>
 *
 * Ese contrato es lo que permite que el mismo servicio sea invocado desde:
 *   - un `createServerFn` (RPC interno del frontend, Fase 1/3),
 *   - una ruta REST `/api/v1/*` (Fase 2),
 *   - un job, un test o un script CLI (inyectando un cliente propio).
 *
 * Ningún fichero de `src/core/` debe importar React, TanStack, `Request`,
 * `Response` ni nada relacionado con el transporte.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Puerto de persistencia.
 * Hoy es un cliente Supabase ya autenticado como el usuario de la sesión, por
 * lo que RLS actúa como segunda barrera además de los filtros `user_id`
 * explícitos que aplican los servicios.
 */
export type RoadGateDb = SupabaseClient<Database>;

/**
 * Identidad del llamante ya verificada por el adaptador (middleware de sesión
 * en RPC, o verificación de API key/JWT en REST). El core CONFÍA en este dato:
 * autenticar es responsabilidad del adaptador, autorizar (¿este roadmap es
 * suyo?) es responsabilidad del core.
 */
export type RoadGateActor = {
  /** UUID de `auth.users`. Clave de particionado de todos los datos. */
  userId: string;
  /** Email del actor, usado para el audit trail de capacidad. */
  email?: string | null;
};

/** Contexto completo que reciben todos los servicios del core. */
export type RoadGateContext = RoadGateActor & {
  db: RoadGateDb;
  /**
   * Permisos concedidos al llamante (Fase 4). Una sesión de usuario tiene
   * permiso total; una API key sólo los scopes con los que fue emitida.
   * El adaptador es quien lo comprueba antes de invocar el caso de uso.
   */
  scopes?: string[];
  /** Cómo se autenticó el llamante: sesión de la app o API key de integración. */
  authMethod?: "session" | "api_key";
};
