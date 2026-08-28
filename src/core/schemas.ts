/**
 * =============================================================================
 * Esquemas de validación del core (Zod)
 * =============================================================================
 * Fuente única de verdad para la FORMA de las entradas del dominio.
 *
 * Por qué vive aquí y no en el adaptador:
 *  - El RPC del frontend y la futura API REST comparten exactamente las mismas
 *    reglas: si se validara en cada adaptador acabarían divergiendo.
 *  - Estos esquemas serán la base del contrato OpenAPI de la Fase 5.
 *
 * Convención: los servicios reciben SIEMPRE datos ya parseados con estos
 * esquemas (usan `parseInput`, que traduce el `ZodError` a `ValidationError`).
 */
import { z } from "zod";
import { ValidationError } from "./errors";

/** UUID v4 de Postgres (`roadmaps.id`, `roadmap_items.item_uid`, …). */
export const uuidSchema = z.string().uuid("Must be a valid UUID");

/** Tipos de work item de la jerarquía RoadGate: Epic → Feature → User Story. */
export const itemTypeSchema = z.enum(["epic", "feature", "story"]);

/**
 * Quarter de planificación. La cadena vacía significa "en backlog" y "MULTI"
 * es un estado DERIVADO de los padres cuyos hijos están repartidos: se acepta
 * en la entrada porque el cliente envía el snapshot ya normalizado.
 */
export const quarterSchema = z.enum(["Q1", "Q2", "Q3", "Q4", "MULTI", ""]);

/** Quarters reales (los únicos que consumen capacidad). */
export const realQuarterSchema = z.enum(["Q1", "Q2", "Q3", "Q4"]);

/** Prioridad del "gate" de priorización. Vacío = sin priorizar (backlog). */
export const prioritySchema = z.enum(["1-High", "2-Medium", "3-Low", "4-Lowest", ""]);

/** Estado de ejecución del item. */
export const stateSchema = z.enum(["Backlog", "In Progress", "Done", "Blocked"]);

/** Cómo se pinta el item en el roadmap: automático, él mismo, o sus hijos. */
export const displayModeSchema = z.enum(["auto", "self", "children"]);

/**
 * Work item completo tal y como circula entre cliente y core.
 * `uid` es la clave estable interna; `id` es el código visible y editable por
 * el usuario (EPIC-01, 14385, …) y es lo que referencia `parentId`.
 */
export const roadmapItemSchema = z.object({
  uid: z.string().min(1),
  id: z.string().min(1, "Item code is required").max(120),
  type: itemTypeSchema,
  title: z.string().max(500).default(""),
  description: z.string().max(20000).optional(),
  parentId: z.string().max(120).optional(),
  effort: z.number().nonnegative().finite().optional(),
  priority: prioritySchema.optional(),
  quarter: quarterSchema.optional(),
  sprint: z.number().int().positive().optional(),
  state: stateSchema.optional(),
  notes: z.string().max(20000).optional(),
  tags: z.string().max(2000).optional(),
  displayMode: displayModeSchema.optional(),
  hiddenFromRoadmap: z.boolean().optional(),
});

/** Mapa parcial Quarter → número (overrides de sprints y de horas). */
const byQuarterNumberSchema = z.record(realQuarterSchema, z.number().nonnegative().finite());

/**
 * Configuración de capacidad de un roadmap (una fila por roadmap).
 * `hoursByQuarter` tiene prioridad sobre el cálculo
 * `devs x dedicación x sprints x días x horas`.
 */
export const capacityConfigSchema = z.object({
  developers: z.number().int().nonnegative().max(10000),
  dedicationPct: z.number().min(0).max(100),
  daysPerSprint: z.number().int().nonnegative().max(365),
  hoursPerDay: z.number().min(0).max(24),
  sprintsPerQuarter: z.number().int().nonnegative().max(52),
  sprintsByQuarter: byQuarterNumberSchema.optional(),
  hoursByQuarter: byQuarterNumberSchema.optional(),
});

/** Nombre de roadmap: se recorta y se rechaza si queda vacío. */
export const roadmapNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name is too long");

// --- Entradas por caso de uso -------------------------------------------------

/** `createRoadmap`: el nombre es opcional; el servicio pone uno por defecto. */
export const createRoadmapInput = z.object({
  name: z.string().max(200).optional(),
});

/** `renameRoadmap`. */
export const renameRoadmapInput = z.object({
  roadmapId: uuidSchema,
  name: roadmapNameSchema,
});

/** Cualquier operación que sólo necesite identificar el roadmap. */
export const roadmapRefInput = z.object({
  roadmapId: uuidSchema,
});

/** `replaceItems`: snapshot completo de los work items del roadmap. */
export const replaceItemsInput = z.object({
  roadmapId: uuidSchema,
  items: z.array(roadmapItemSchema).max(10000, "Too many items in a single roadmap"),
});

/** `saveCapacity`. */
export const saveCapacityInput = z.object({
  roadmapId: uuidSchema,
  capacity: capacityConfigSchema,
});

/** `getWorkspaceStats`: filtro opcional por roadmap. */
export const workspaceStatsInput = z.object({
  roadmapId: uuidSchema.nullish(),
});

/**
 * Parsea una entrada con un esquema y traduce el fallo a `ValidationError`,
 * para que ningún `ZodError` crudo escape del core hacia los adaptadores.
 */
export function parseInput<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid input", result.error.flatten());
  }
  return result.data;
}

// --- Fase III · Colaboración por roadmap -------------------------------------

/** Roles compartibles de un roadmap (el `admin` no se asigna, se transfiere). */
export const roadmapShareRoleSchema = z.enum(["editor", "viewer"]);

/** `shareRoadmap`: conceder acceso a un miembro activo del equipo. */
export const shareRoadmapInput = z.object({
  roadmapId: uuidSchema,
  teamMemberId: uuidSchema,
  role: roadmapShareRoleSchema,
});

/** Referencia a una fila de `roadmap_members`. */
export const roadmapMemberRefInput = z.object({
  roadmapId: uuidSchema,
  memberId: uuidSchema,
});

/** `updateRoadmapMemberRole`. */
export const updateRoadmapMemberInput = roadmapMemberRefInput.extend({
  role: roadmapShareRoleSchema,
});

/** `transferRoadmapAdmin`. */
export const transferRoadmapAdminInput = z.object({
  roadmapId: uuidSchema,
  teamMemberId: uuidSchema,
});
