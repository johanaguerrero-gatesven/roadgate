/**
 * =============================================================================
 * Adaptador RPC (TanStack Start) del core de RoadGate
 * =============================================================================
 * Este fichero YA NO contiene lógica de negocio. Desde la Fase 1 su única
 * responsabilidad es adaptar el transporte:
 *
 *   1. Autenticar la petición (`requireSupabaseAuth`) y construir el
 *      `RoadGateContext` que espera el core.
 *   2. Delegar en el servicio correspondiente de `@/core`.
 *   3. Devolver el DTO plano que el servicio produce.
 *
 * Toda la lógica (validación, autorización sobre el recurso, mapeo BD↔dominio,
 * audit trail) vive en `src/core/`. La API REST pública de la Fase 2 será otro
 * adaptador igual de fino sobre exactamente los mismos servicios, de forma que
 * frontend y terceros compartan comportamiento sin duplicar código.
 *
 * Los nombres exportados se mantienen intactos para no romper las pantallas que
 * ya los consumen.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as core from "@/core";
import type { RoadGateContext } from "@/core";
import type { CapacityConfig, RoadmapItem } from "./roadmap";

/**
 * Construye el contexto del core a partir del contexto del middleware.
 * El middleware ya ha verificado el bearer token, así que aquí sólo se traduce
 * la forma: cliente Supabase autenticado + identidad del actor.
 */
function toCoreContext(context: {
  supabase: unknown;
  userId: string;
  claims: unknown;
}): RoadGateContext {
  return {
    db: context.supabase as RoadGateContext["db"],
    userId: context.userId,
    email: (context.claims as { email?: string }).email ?? null,
  };
}

/** Lista los roadmaps del usuario con su número de work items. */
export const listRoadmaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => core.listRoadmaps(toCoreContext(context)));

/** Métricas del workspace, opcionalmente acotadas a un roadmap concreto. */
export const getWorkspaceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { roadmapId?: string | null }) => d ?? {})
  .handler(async ({ context, data }) => core.getWorkspaceStats(toCoreContext(context), data));

/** Crea un roadmap vacío y devuelve su id para navegar. */
export const createRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => core.createRoadmap(toCoreContext(context), data));

/** Renombra un roadmap del usuario. */
export const renameRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string; name: string }) => d)
  .handler(async ({ data, context }) => core.renameRoadmap(toCoreContext(context), data));

/** Borra un roadmap del usuario (items y capacidad caen en cascada). */
export const deleteRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => core.deleteRoadmap(toCoreContext(context), data));

/** Carga completa de un roadmap: cabecera + items + capacidad. */
export const fetchRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => core.getRoadmap(toCoreContext(context), data));

/** Persiste el snapshot completo de work items (estrategia replace-all). */
export const persistItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string; items: RoadmapItem[] }) => d)
  .handler(async ({ data, context }) => core.replaceItems(toCoreContext(context), data));

/** Guarda la capacidad del roadmap y registra el audit trail de los cambios. */
export const persistCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string; capacity: CapacityConfig }) => d)
  .handler(async ({ data, context }) => core.saveCapacity(toCoreContext(context), data));

/** Histórico de cambios de capacidad del roadmap (200 apuntes más recientes). */
export const fetchCapacityHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => core.listCapacityHistory(toCoreContext(context), data));

/** Vacía un roadmap (items + capacidad) conservando la cabecera. */
export const resetRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roadmapId: string }) => d)
  .handler(async ({ data, context }) => core.resetRoadmap(toCoreContext(context), data));
