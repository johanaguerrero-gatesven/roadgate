/**
 * =============================================================================
 * Contrato OpenAPI 3.1 de la API pública de RoadGate (Fase 5)
 * =============================================================================
 * Fuente única de verdad de la documentación. Se sirve tal cual en
 * `GET /api/public/v1/openapi.json` y la página `/docs/api` la renderiza.
 *
 * Regla de mantenimiento: cualquier cambio en `src/routes/api/public/v1/*`
 * o en `src/core/schemas.ts` debe reflejarse aquí en el mismo commit. El
 * contrato es público: romperlo obliga a versionar (`/v2`).
 */

/** Enumeraciones del dominio, reutilizadas por varios esquemas. */
const ITEM_TYPES = ["epic", "feature", "story"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4", "MULTI", ""];
const PRIORITIES = ["1-High", "2-Medium", "3-Low", "4-Lowest", ""];
const STATES = ["Backlog", "In Progress", "Done", "Blocked"];
const SCOPES = ["roadmaps:read", "roadmaps:write"];

/** Respuesta de error reutilizable con su `code` estable del contrato. */
function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
}

/** Respuestas de error comunes a casi todos los endpoints. */
const COMMON_ERRORS = {
  "400": errorResponse("Entrada inválida (`validation_error`)."),
  "401": errorResponse("Credenciales ausentes o inválidas (`unauthorized`)."),
  "403": errorResponse("Falta el scope requerido (`forbidden`)."),
  "404": errorResponse("El recurso no existe o no pertenece al actor (`not_found`)."),
  "500": errorResponse("Error interno (`internal_error`)."),
};

/** Documento OpenAPI completo. */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "RoadGate API",
    version: "1.0.0",
    description: [
      "API pública de RoadGate: roadmaps trimestrales, work items jerárquicos",
      "(Epic → Feature → User Story), capacidad del equipo y métricas.",
      "",
      "## Autenticación",
      "Todas las llamadas requieren `Authorization: Bearer <token>`, donde el token es:",
      "",
      "- **API key de integración** (`rg_live_…`): se emite en Ajustes → API keys y",
      "  se muestra una sola vez. Sus permisos vienen dados por sus *scopes*.",
      "- **Access token de sesión** (JWT): lo usa el propio frontend de RoadGate.",
      "",
      "## Scopes",
      "- `roadmaps:read` — lecturas (GET).",
      "- `roadmaps:write` — creación, actualización y borrado.",
      "",
      "La gestión de API keys (`/api-keys`) sólo admite sesión de usuario: una API key",
      "no puede emitir ni revocar otras claves.",
      "",
      "## Errores",
      "Todo error devuelve `{ \"error\": { \"code\", \"message\", \"details?\" } }`.",
      "El `code` es estable y es lo que debe inspeccionar un integrador.",
      "",
      "## CORS",
      "Todos los endpoints admiten `OPTIONS` (preflight) y responden con",
      "`Access-Control-Allow-Origin: *`, por lo que la API puede consumirse desde el navegador.",
    ].join("\n"),
  },
  servers: [{ url: "/api/public/v1", description: "Versión 1 de la API" }],
  tags: [
    { name: "Roadmaps", description: "Alta, consulta, renombrado y borrado de roadmaps." },
    { name: "Work items", description: "Snapshot completo de los items de un roadmap." },
    { name: "Capacity", description: "Capacidad del equipo y su historial de cambios." },
    { name: "Stats", description: "Métricas agregadas del workspace." },
    { name: "API keys", description: "Credenciales de integración (sólo con sesión)." },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/roadmaps": {
      get: {
        tags: ["Roadmaps"],
        summary: "Lista los roadmaps del actor",
        operationId: "listRoadmaps",
        security: [{ bearerAuth: ["roadmaps:read"] }],
        responses: {
          "200": {
            description: "Roadmaps ordenados por fecha de actualización.",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/RoadmapSummary" } },
              },
            },
          },
          ...COMMON_ERRORS,
        },
      },
      post: {
        tags: ["Roadmaps"],
        summary: "Crea un roadmap vacío",
        operationId: "createRoadmap",
        security: [{ bearerAuth: ["roadmaps:write"] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { name: { type: "string", maxLength: 200 } },
              },
              example: { name: "Roadmap 2026" },
            },
          },
        },
        responses: {
          "201": {
            description: "Roadmap creado.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["id"],
                  properties: { id: { type: "string", format: "uuid" } },
                },
              },
            },
          },
          ...COMMON_ERRORS,
        },
      },
    },

    "/roadmaps/{roadmapId}": {
      parameters: [{ $ref: "#/components/parameters/RoadmapId" }],
      get: {
        tags: ["Roadmaps"],
        summary: "Carga completa de un roadmap",
        description: "Devuelve la cabecera, todos sus work items y su configuración de capacidad.",
        operationId: "getRoadmap",
        security: [{ bearerAuth: ["roadmaps:read"] }],
        responses: {
          "200": {
            description: "Roadmap completo.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RoadmapDetail" } },
            },
          },
          ...COMMON_ERRORS,
        },
      },
      patch: {
        tags: ["Roadmaps"],
        summary: "Renombra un roadmap",
        operationId: "renameRoadmap",
        security: [{ bearerAuth: ["roadmaps:write"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string", minLength: 1, maxLength: 200 } },
              },
            },
          },
        },
        responses: { "200": { $ref: "#/components/responses/Ok" }, ...COMMON_ERRORS },
      },
      delete: {
        tags: ["Roadmaps"],
        summary: "Borra un roadmap",
        description: "Elimina en cascada sus work items, su capacidad y su historial.",
        operationId: "deleteRoadmap",
        security: [{ bearerAuth: ["roadmaps:write"] }],
        responses: { "200": { $ref: "#/components/responses/Ok" }, ...COMMON_ERRORS },
      },
    },

    "/roadmaps/{roadmapId}/items": {
      parameters: [{ $ref: "#/components/parameters/RoadmapId" }],
      put: {
        tags: ["Work items"],
        summary: "Reemplaza todos los work items",
        description:
          "Estrategia *replace-all*: el cuerpo es el snapshot completo del roadmap. " +
          "Los items que no aparezcan se eliminan.",
        operationId: "replaceItems",
        security: [{ bearerAuth: ["roadmaps:write"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    maxItems: 10000,
                    items: { $ref: "#/components/schemas/RoadmapItem" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Snapshot guardado.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { const: true }, count: { type: "integer" } },
                },
              },
            },
          },
          ...COMMON_ERRORS,
        },
      },
    },

    "/roadmaps/{roadmapId}/capacity": {
      parameters: [{ $ref: "#/components/parameters/RoadmapId" }],
      put: {
        tags: ["Capacity"],
        summary: "Guarda la capacidad del roadmap",
        description:
          "Registra además el audit trail de los campos modificados " +
          "(consultable en `/roadmaps/{roadmapId}/capacity/history`).",
        operationId: "saveCapacity",
        security: [{ bearerAuth: ["roadmaps:write"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["capacity"],
                properties: { capacity: { $ref: "#/components/schemas/CapacityConfig" } },
              },
            },
          },
        },
        responses: { "200": { $ref: "#/components/responses/Ok" }, ...COMMON_ERRORS },
      },
    },

    "/roadmaps/{roadmapId}/capacity/history": {
      parameters: [{ $ref: "#/components/parameters/RoadmapId" }],
      get: {
        tags: ["Capacity"],
        summary: "Historial de cambios de capacidad",
        operationId: "getCapacityHistory",
        security: [{ bearerAuth: ["roadmaps:read"] }],
        responses: {
          "200": {
            description: "Cambios ordenados del más reciente al más antiguo.",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CapacityHistoryEntry" },
                },
              },
            },
          },
          ...COMMON_ERRORS,
        },
      },
    },

    "/teams/me": {
      get: {
        tags: ["Teams"],
        summary: "Equipo activo del usuario",
        description:
          "Devuelve la cuenta de equipo del actor; se provisiona automáticamente la primera vez.",
        operationId: "getActiveTeam",
        security: [{ bearerAuth: ["roadmaps:read"] }],
        responses: {
          "200": {
            description: "Equipo activo.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    status: { type: "string" },
                    plan: { type: "string" },
                    seatLimit: { type: "integer" },
                    role: { type: "string", enum: ["admin", "member"] },
                    memberId: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/stats": {

      get: {
        tags: ["Stats"],
        summary: "Métricas del workspace",
        description: "Sin `roadmapId` agrega todo el workspace; con él, sólo ese roadmap.",
        operationId: "getWorkspaceStats",
        security: [{ bearerAuth: ["roadmaps:read"] }],
        parameters: [
          {
            name: "roadmapId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Filtra las métricas a un roadmap concreto.",
          },
        ],
        responses: {
          "200": {
            description: "Métricas agregadas.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/WorkspaceStats" } },
            },
          },
          ...COMMON_ERRORS,
        },
      },
    },

    "/api-keys": {
      get: {
        tags: ["API keys"],
        summary: "Lista las API keys del usuario",
        description: "Requiere sesión de usuario; no se puede llamar con una API key.",
        operationId: "listApiKeys",
        responses: {
          "200": {
            description: "Claves del usuario, sin secretos.",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } },
              },
            },
          },
          ...COMMON_ERRORS,
        },
      },
      post: {
        tags: ["API keys"],
        summary: "Emite una API key",
        description:
          "El secreto (`key`) se devuelve **una única vez**: en la base de datos sólo " +
          "se guarda su hash SHA-256.",
        operationId: "createApiKey",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 120 },
                  scopes: { type: "array", items: { type: "string", enum: SCOPES } },
                  expiresInDays: { type: "integer", minimum: 1 },
                },
              },
              example: { name: "Integración Jira", scopes: SCOPES, expiresInDays: 365 },
            },
          },
        },
        responses: {
          "201": {
            description: "Clave emitida.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    key: { type: "string", example: "rg_live_…" },
                    apiKey: { $ref: "#/components/schemas/ApiKey" },
                  },
                },
              },
            },
          },
          ...COMMON_ERRORS,
        },
      },
    },

    "/api-keys/{keyId}": {
      parameters: [
        {
          name: "keyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Identificador de la API key.",
        },
      ],
      delete: {
        tags: ["API keys"],
        summary: "Revoca o borra una API key",
        description:
          "Por defecto revoca (marca `revokedAt` y conserva la traza). " +
          "Con `?purge=true` elimina la fila por completo.",
        operationId: "revokeApiKey",
        parameters: [
          {
            name: "purge",
            in: "query",
            required: false,
            schema: { type: "boolean", default: false },
            description: "`true` borra la fila en lugar de revocarla.",
          },
        ],
        responses: { "200": { $ref: "#/components/responses/Ok" }, ...COMMON_ERRORS },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "API key de integración (`rg_live_…`) o access token JWT de la sesión de RoadGate.",
      },
    },
    parameters: {
      RoadmapId: {
        name: "roadmapId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Identificador del roadmap.",
      },
    },
    responses: {
      Ok: {
        description: "Operación completada.",
        content: {
          "application/json": {
            schema: { type: "object", properties: { ok: { const: true } } },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                enum: [
                  "validation_error",
                  "unauthorized",
                  "forbidden",
                  "not_found",
                  "conflict",
                  "internal_error",
                ],
                description: "Código estable, apto para lógica de cliente.",
              },
              message: { type: "string", description: "Mensaje legible para humanos." },
              details: { description: "Detalle de validación cuando aplica." },
            },
          },
        },
        example: { error: { code: "not_found", message: "Roadmap not found" } },
      },

      RoadmapSummary: {
        type: "object",
        required: ["id", "name", "createdAt", "updatedAt", "itemCount"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          itemCount: { type: "integer", description: "Número de work items del roadmap." },
        },
      },

      RoadmapDetail: {
        type: "object",
        required: ["roadmap", "items", "capacity"],
        properties: {
          roadmap: {
            type: "object",
            required: ["id", "name"],
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
            },
          },
          items: { type: "array", items: { $ref: "#/components/schemas/RoadmapItem" } },
          capacity: { $ref: "#/components/schemas/CapacityConfig" },
        },
      },

      RoadmapItem: {
        type: "object",
        required: ["uid", "id", "type"],
        description:
          "Work item de la jerarquía Epic → Feature → User Story. `uid` es la clave " +
          "estable interna; `id` es el código visible y es lo que referencia `parentId`.",
        properties: {
          uid: { type: "string", minLength: 1, description: "Clave estable interna." },
          id: { type: "string", maxLength: 120, description: "Código visible (p. ej. EPIC-01)." },
          type: { type: "string", enum: ITEM_TYPES },
          title: { type: "string", maxLength: 500, default: "" },
          description: { type: "string", maxLength: 20000 },
          parentId: { type: "string", maxLength: 120, description: "`id` del item padre." },
          effort: {
            type: "number",
            minimum: 0,
            description: "Horas. En los padres es la suma de sus hijos.",
          },
          priority: { type: "string", enum: PRIORITIES },
          quarter: {
            type: "string",
            enum: QUARTERS,
            description: "Vacío = backlog. `MULTI` = hijos repartidos entre varios quarters.",
          },
          sprint: { type: "integer", minimum: 1, deprecated: true },
          state: { type: "string", enum: STATES },
          notes: { type: "string", maxLength: 20000 },
          tags: { type: "string", maxLength: 2000 },
          displayMode: { type: "string", enum: ["auto", "self", "children"] },
          hiddenFromRoadmap: { type: "boolean", default: false },
        },
      },

      CapacityConfig: {
        type: "object",
        required: [
          "developers",
          "dedicationPct",
          "daysPerSprint",
          "hoursPerDay",
          "sprintsPerQuarter",
        ],
        description:
          "Capacidad = devs × dedicación × sprints × días × horas. " +
          "`hoursByQuarter` tiene prioridad sobre ese cálculo.",
        properties: {
          developers: { type: "integer", minimum: 0, maximum: 10000 },
          dedicationPct: { type: "number", minimum: 0, maximum: 100 },
          daysPerSprint: { type: "integer", minimum: 0, maximum: 365 },
          hoursPerDay: { type: "number", minimum: 0, maximum: 24 },
          sprintsPerQuarter: { type: "integer", minimum: 0, maximum: 52 },
          sprintsByQuarter: { $ref: "#/components/schemas/ByQuarterNumber" },
          hoursByQuarter: { $ref: "#/components/schemas/ByQuarterNumber" },
        },
      },

      ByQuarterNumber: {
        type: "object",
        description: "Overrides por quarter real.",
        properties: {
          Q1: { type: "number", minimum: 0 },
          Q2: { type: "number", minimum: 0 },
          Q3: { type: "number", minimum: 0 },
          Q4: { type: "number", minimum: 0 },
        },
        additionalProperties: false,
      },

      CapacityHistoryEntry: {
        type: "object",
        required: ["id", "field", "by", "at"],
        properties: {
          id: { type: "string", format: "uuid" },
          field: { type: "string", description: "Campo modificado (p. ej. `hoursByQuarter.Q3`)." },
          oldValue: { type: "string", nullable: true },
          newValue: { type: "string", nullable: true },
          by: { type: "string", description: "Email de quien hizo el cambio." },
          at: { type: "string", format: "date-time" },
        },
      },

      WorkspaceStats: {
        type: "object",
        required: ["roadmapsCount", "teamsCount", "totalDevelopers", "totalItems", "byType"],
        properties: {
          roadmapsCount: { type: "integer" },
          teamsCount: { type: "integer" },
          totalDevelopers: { type: "integer" },
          totalItems: { type: "integer" },
          byType: {
            type: "object",
            properties: {
              epic: { type: "integer" },
              feature: { type: "integer" },
              story: { type: "integer" },
            },
          },
        },
      },

      ApiKey: {
        type: "object",
        required: ["id", "name", "prefix", "scopes", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          prefix: { type: "string", description: "Prefijo visible para identificar la clave." },
          scopes: { type: "array", items: { type: "string", enum: SCOPES } },
          createdAt: { type: "string", format: "date-time" },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          revokedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
} as const;
