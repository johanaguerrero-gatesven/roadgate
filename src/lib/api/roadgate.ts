/**
 * =============================================================================
 * SDK de RoadGate para el frontend (Fase 3)
 * =============================================================================
 * Una función por endpoint de la API pública v1. Las pantallas importan SOLO
 * desde aquí: si mañana la API se sirve desde otro dominio o cambia de versión,
 * este fichero es el único punto a tocar.
 *
 * Los nombres se mantienen alineados con los antiguos RPC (`listRoadmaps`,
 * `fetchRoadmap`, ...) para que la migración de las pantallas sea mecánica,
 * pero la firma ahora es la natural de un SDK: argumentos planos, no `{ data }`.
 */
import { apiFetch } from "./http";
import type { CapacityConfig, RoadmapItem } from "@/lib/roadmap";

// --- Tipos del contrato público ---------------------------------------------

export type RoadmapSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

export type RoadmapDetail = {
  roadmap: { id: string; name: string };
  items: RoadmapItem[];
  capacity: CapacityConfig;
};

export type WorkspaceStats = {
  roadmapsCount: number;
  teamsCount: number;
  totalDevelopers: number;
  totalItems: number;
  byType: { epic: number; feature: number; story: number };
};

export type CapacityHistoryEntry = {
  id: string;
  /** Campo modificado, en notación plana (p. ej. `hoursByQuarter.Q3`). */
  field: string;
  oldValue: string | null;
  newValue: string | null;
  /** Email de quien hizo el cambio. */
  by: string;
  /** Timestamp ISO del cambio. */
  at: string;
};

// --- Equipo ------------------------------------------------------------------

export type ActiveTeam = {
  id: string;
  name: string;
  status: string;
  plan: string;
  seatLimit: number;
  role: "admin" | "member";
  memberId: string;
};

/** GET /teams/me — equipo activo del usuario (se crea la primera vez). */
export function fetchActiveTeam(): Promise<ActiveTeam> {
  return apiFetch<ActiveTeam>("/teams/me");
}

// --- Roadmaps ----------------------------------------------------------------


/** GET /roadmaps — roadmaps del usuario con su número de items. */
export function listRoadmaps(): Promise<RoadmapSummary[]> {
  return apiFetch<RoadmapSummary[]>("/roadmaps");
}

/** POST /roadmaps — crea un roadmap vacío y devuelve su id. */
export function createRoadmap(input: { name: string }): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/roadmaps", { method: "POST", body: input });
}

/** PATCH /roadmaps/:id — renombra. */
export function renameRoadmap(input: { roadmapId: string; name: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/roadmaps/${input.roadmapId}`, {
    method: "PATCH",
    body: { name: input.name },
  });
}

/** DELETE /roadmaps/:id — borra el roadmap y su contenido en cascada. */
export function deleteRoadmap(input: { roadmapId: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/roadmaps/${input.roadmapId}`, { method: "DELETE" });
}

/** GET /roadmaps/:id — carga completa: cabecera + items + capacidad. */
export function fetchRoadmap(input: { roadmapId: string }): Promise<RoadmapDetail> {
  return apiFetch<RoadmapDetail>(`/roadmaps/${input.roadmapId}`);
}

// --- Work items --------------------------------------------------------------

/** PUT /roadmaps/:id/items — snapshot completo (estrategia replace-all). */
export function persistItems(input: {
  roadmapId: string;
  items: RoadmapItem[];
}): Promise<{ ok: true; count: number }> {
  return apiFetch<{ ok: true; count: number }>(`/roadmaps/${input.roadmapId}/items`, {
    method: "PUT",
    body: { items: input.items },
  });
}

// --- Capacidad ---------------------------------------------------------------

/** PUT /roadmaps/:id/capacity — guarda capacidad y registra el audit trail. */
export function persistCapacity(input: {
  roadmapId: string;
  capacity: CapacityConfig;
}): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/roadmaps/${input.roadmapId}/capacity`, {
    method: "PUT",
    body: { capacity: input.capacity },
  });
}

/** GET /roadmaps/:id/capacity/history — histórico de cambios de capacidad. */
export function fetchCapacityHistory(input: {
  roadmapId: string;
}): Promise<CapacityHistoryEntry[]> {
  return apiFetch<CapacityHistoryEntry[]>(`/roadmaps/${input.roadmapId}/capacity/history`);
}

// --- Métricas ----------------------------------------------------------------

/** GET /stats?roadmapId= — métricas del workspace o de un roadmap concreto. */
export function getWorkspaceStats(input?: { roadmapId?: string | null }): Promise<WorkspaceStats> {
  return apiFetch<WorkspaceStats>("/stats", { query: { roadmapId: input?.roadmapId ?? null } });
}

// --- API keys de integración (Fase 4) ----------------------------------------

export type ApiKeySummary = {
  id: string;
  name: string;
  /** Prefijo visible (`rg_live_xxxxxxxx`). El secreto completo no se almacena. */
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

/** GET /api-keys — claves del usuario (nunca incluye secretos). */
export function listApiKeys(): Promise<ApiKeySummary[]> {
  return apiFetch<ApiKeySummary[]>("/api-keys");
}

/**
 * POST /api-keys — emite una clave nueva.
 * `key` es el secreto en claro y sólo se devuelve en esta respuesta.
 */
export function createApiKey(input: {
  name: string;
  scopes: string[];
  expiresInDays?: number;
}): Promise<{ key: string; apiKey: ApiKeySummary }> {
  return apiFetch<{ key: string; apiKey: ApiKeySummary }>("/api-keys", {
    method: "POST",
    body: input,
  });
}

/** DELETE /api-keys/:id — revoca la clave (deja de funcionar de inmediato). */
export function revokeApiKey(input: { keyId: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api-keys/${input.keyId}`, { method: "DELETE" });
}

/** DELETE /api-keys/:id?purge=true — elimina la clave del listado. */
export function deleteApiKey(input: { keyId: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api-keys/${input.keyId}`, {
    method: "DELETE",
    query: { purge: "true" },
  });
}

// --- Miembros e invitaciones del equipo (Fase II) ----------------------------

export type TeamMemberView = {
  id: string;
  userId: string;
  email: string | null;
  role: "admin" | "member";
  status: "active" | "inactive";
  createdAt: string;
};

export type TeamInvitationView = {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: "pending" | "expired" | "accepted" | "revoked";
};

export type IssuedInvitationResponse = {
  invitation: TeamInvitationView;
  emailSent: boolean;
  inviteUrl: string;
};

/** GET /teams/members — miembros del equipo activo. */
export function listTeamMembers(): Promise<TeamMemberView[]> {
  return apiFetch<TeamMemberView[]>("/teams/members");
}

/** GET /teams/invitations — invitaciones del equipo (sólo Admin). */
export function listTeamInvitations(): Promise<TeamInvitationView[]> {
  return apiFetch<TeamInvitationView[]>("/teams/invitations");
}

/** POST /teams/invitations — invita a un email como Team Member. */
export function inviteTeamMember(input: { email: string }): Promise<IssuedInvitationResponse> {
  return apiFetch<IssuedInvitationResponse>("/teams/invitations", { method: "POST", body: input });
}

/** POST /teams/invitations/:id — reenvía la invitación con un token nuevo. */
export function resendTeamInvitation(input: {
  invitationId: string;
}): Promise<IssuedInvitationResponse> {
  return apiFetch<IssuedInvitationResponse>(`/teams/invitations/${input.invitationId}`, {
    method: "POST",
  });
}

/** DELETE /teams/invitations/:id — revoca la invitación. */
export function revokeTeamInvitation(input: { invitationId: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/teams/invitations/${input.invitationId}`, { method: "DELETE" });
}

/** PATCH /teams/members/:id — activa o desactiva un miembro. */
export function setTeamMemberStatus(input: {
  memberId: string;
  status: "active" | "inactive";
}): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/teams/members/${input.memberId}`, {
    method: "PATCH",
    body: { status: input.status },
  });
}

/** POST /teams/invitations/accept — acepta una invitación con el token. */
export function acceptTeamInvitation(input: { token: string }): Promise<{ teamId: string }> {
  return apiFetch<{ teamId: string }>("/teams/invitations/accept", {
    method: "POST",
    body: input,
  });
}
