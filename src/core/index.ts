/**
 * =============================================================================
 * API pública del core de RoadGate
 * =============================================================================
 * Punto de entrada único del dominio. Los adaptadores (server functions RPC en
 * la Fase 1, rutas REST `/api/v1` en la Fase 2, tests, jobs) importan SOLO
 * desde aquí — nunca ficheros internos sueltos — para que la superficie del
 * core sea explícita y estable.
 *
 * Estructura del core:
 *   context.ts        → puertos: qué necesita el core para trabajar (db, actor)
 *   errors.ts         → errores de dominio con `code` + `status` sugerido
 *   schemas.ts        → validación Zod de todas las entradas (contrato)
 *   mappers.ts        → traducción BD (snake_case) ↔ dominio (camelCase)
 *   services/*.ts     → casos de uso, agrupados por agregado
 *
 * Regla de oro: nada dentro de `src/core/` puede importar React, TanStack ni
 * objetos HTTP. Si un servicio necesitase eso, el diseño está mal.
 */

export type { RoadGateContext, RoadGateActor, RoadGateDb } from "./context";
export {
  DomainError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  StorageError,
  type DomainErrorCode,
} from "./errors";

export * as schemas from "./schemas";

// --- Casos de uso ------------------------------------------------------------

export {
  assertRoadmapOwned,
  assertRoadmapReadable,
  listRoadmaps,
  createRoadmap,
  renameRoadmap,
  deleteRoadmap,
  getRoadmap,
  resetRoadmap,
  type RoadmapSummary,
  type RoadmapDetail,
} from "./services/roadmap-service";

export { listItems, replaceItems } from "./services/item-service";

// --- Fase III · Colaboración por roadmap -------------------------------------
export {
  getRoadmapRole,
  requireRoadmapAccess,
  listAccessibleRoadmapIds,
  listRoadmapMembers,
  listShareCandidates,
  shareRoadmap,
  updateRoadmapMemberRole,
  revokeRoadmapMember,
  transferRoadmapAdmin,
  type RoadmapRole,
  type RoadmapMemberView,
  type ShareCandidate,
} from "./services/sharing-service";

export {
  getCapacity,
  saveCapacity,
  listCapacityHistory,
  type CapacityHistoryEntry,
} from "./services/capacity-service";

export { getWorkspaceStats, type WorkspaceStats } from "./services/stats-service";

export {
  listTeamMembers,
  listTeamInvitations,
  inviteMember,
  resendInvitation,
  revokeInvitation,
  setMemberStatus,
  listMemberAdminRoadmaps,
  acceptInvitation,
  INVITATION_TTL_DAYS,
  type TeamMemberView,
  type TeamInvitationView,
  type IssuedInvitation,
  type AdministeredRoadmap,
} from "./services/membership-service";

export {
  recordAuditEvent,
  listAuditEvents,
  type AuditAction,
  type AuditEventView,
} from "./services/audit-service";

export {
  ensureActiveTeam,
  getActiveTeam,
  type ActiveTeam,
} from "./services/team-service";


export {
  API_SCOPES,
  API_KEY_PREFIX,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  resolveApiKey,
  hashApiKey,
  type ApiScope,
  type ApiKeySummary,
} from "./services/api-key-service";
