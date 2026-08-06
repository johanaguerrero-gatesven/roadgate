/**
 * =============================================================================
 * Fase 3 · Tests de los adaptadores REST (`/api/public/v1/*`)
 * =============================================================================
 * Se prueban los handlers HTTP reales importados desde los ficheros de ruta,
 * con el core ejecutándose de verdad sobre el doble de base de datos. Lo único
 * que se falsea es `createRestContext` (autenticación), porque verificar un JWT
 * de Supabase no es responsabilidad de estos endpoints: eso se prueba aparte en
 * `rest-context.test.ts`.
 *
 * Qué se verifica aquí:
 *   - códigos de estado y forma del cuerpo (contrato público),
 *   - propagación de errores de dominio → `{ error: { code, message } }`,
 *   - enforcement de scopes de API key y de "sólo sesión" en /api-keys,
 *   - preflight CORS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestCtx, type Tables } from "@/test/fake-db";
import type { RoadGateContext } from "@/core";

const RID = "11111111-1111-4111-8111-111111111111";
const OTHER_RID = "22222222-2222-4222-8222-222222222222";

/** Contexto que devolverá el `createRestContext` falseado en cada test. */
let currentCtx: RoadGateContext;
let tables: Tables;

vi.mock("@/lib/rest/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rest/context")>();
  return {
    ...actual,
    // Sólo se sustituye la autenticación; `requireScope`/`requireSession` son
    // los reales, que es justo lo que queremos ejercitar.
    createRestContext: vi.fn(async () => currentCtx),
  };
});

// Los imports de rutas van DESPUÉS del mock (vi.mock se iza igualmente).
const { Route: RoadmapsRoute } = await import("@/routes/api/public/v1/roadmaps/index");
const { Route: RoadmapRoute } = await import("@/routes/api/public/v1/roadmaps/$roadmapId/index");
const { Route: ItemsRoute } = await import("@/routes/api/public/v1/roadmaps/$roadmapId/items");
const { Route: CapacityRoute } = await import(
  "@/routes/api/public/v1/roadmaps/$roadmapId/capacity/index"
);
const { Route: StatsRoute } = await import("@/routes/api/public/v1/stats");
const { Route: ApiKeysRoute } = await import("@/routes/api/public/v1/api-keys/index");

/** Extrae un handler HTTP de un fichero de ruta de TanStack. */
type AnyHandler = (arg: {
  request: Request;
  params: Record<string, string>;
}) => Promise<Response>;
function handler(route: unknown, method: string): AnyHandler {
  const handlers = (route as { options: { server: { handlers: Record<string, AnyHandler> } } })
    .options.server.handlers;
  return handlers[method]!;
}

/** Petición de prueba con credenciales (el contexto está falseado igualmente). */
function req(url: string, init?: RequestInit) {
  return new Request(`https://roadgate.test${url}`, {
    ...init,
    headers: { authorization: "Bearer test-token", ...(init?.headers ?? {}) },
  });
}

async function call(
  route: unknown,
  method: string,
  url: string,
  opts: { params?: Record<string, string>; body?: unknown } = {},
) {
  const res = await handler(
    route,
    method,
  )({
    request: req(url, opts.body === undefined ? undefined : { method, body: JSON.stringify(opts.body) }),
    params: opts.params ?? {},
  });
  const text = await res.text();
  return { res, body: text ? JSON.parse(text) : null };
}

function seed(): Tables {
  return {
    roadmaps: [
      {
        id: RID,
        user_id: "user-1",
        name: "Mi roadmap",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
      {
        id: OTHER_RID,
        user_id: "user-2",
        name: "Ajeno",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
    ],
    roadmap_items: [
      {
        id: "row-1",
        roadmap_id: RID,
        user_id: "user-1",
        item_uid: "u1",
        item_code: "E-1",
        type: "epic",
        title: "Epic uno",
        description: null,
        parent_id: null,
        effort: 10,
        priority: "1-High",
        quarter: "Q1",
        sprint: null,
        state: "Backlog",
        notes: null,
        tags: null,
        display_mode: null,
        hidden_from_roadmap: false,
      },
    ],
    roadmap_capacity: [],
    roadmap_capacity_history: [],
    roadmap_api_keys: [],
  };
}

beforeEach(() => {
  tables = seed();
  currentCtx = createTestCtx(tables);
});

describe("CORS", () => {
  it("responde 204 al preflight con cabeceras permisivas", async () => {
    const res = await handler(RoadmapsRoute, "OPTIONS")({ request: req("/"), params: {} });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET/POST /api/public/v1/roadmaps", () => {
  it("devuelve 200 con los roadmaps del actor", async () => {
    const { res, body } = await call(RoadmapsRoute, "GET", "/api/public/v1/roadmaps");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: RID, name: "Mi roadmap", itemCount: 1 });
  });

  it("crea un roadmap y responde 201 con su id", async () => {
    const { res, body } = await call(RoadmapsRoute, "POST", "/api/public/v1/roadmaps", {
      body: { name: "Nuevo" },
    });
    expect(res.status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(tables.roadmaps.find((r) => r.id === body.id)?.name).toBe("Nuevo");
  });

  it("rechaza con 400 y código de validación un nombre inválido", async () => {
    const { res, body } = await call(RoadmapsRoute, "POST", "/api/public/v1/roadmaps", {
      body: { name: "x".repeat(500) },
    });
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });
});

describe("/api/public/v1/roadmaps/:id", () => {
  it("devuelve el detalle del roadmap propio", async () => {
    const { res, body } = await call(RoadmapRoute, "GET", `/api/public/v1/roadmaps/${RID}`, {
      params: { roadmapId: RID },
    });
    expect(res.status).toBe(200);
    expect(body.roadmap).toEqual({ id: RID, name: "Mi roadmap" });
    expect(body.items).toHaveLength(1);
    expect(body.capacity).toBeTruthy();
  });

  it("devuelve 404 con code not_found para un roadmap ajeno", async () => {
    const { res, body } = await call(RoadmapRoute, "GET", `/api/public/v1/roadmaps/${OTHER_RID}`, {
      params: { roadmapId: OTHER_RID },
    });
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("renombra con PATCH y borra con DELETE", async () => {
    const patched = await call(RoadmapRoute, "PATCH", `/api/public/v1/roadmaps/${RID}`, {
      params: { roadmapId: RID },
      body: { name: "Renombrado" },
    });
    expect(patched.res.status).toBe(200);
    expect(tables.roadmaps.find((r) => r.id === RID)?.name).toBe("Renombrado");

    const deleted = await call(RoadmapRoute, "DELETE", `/api/public/v1/roadmaps/${RID}`, {
      params: { roadmapId: RID },
    });
    expect(deleted.res.status).toBe(200);
    expect(tables.roadmaps.some((r) => r.id === RID)).toBe(false);
  });
});

describe("/api/public/v1/roadmaps/:id/items", () => {
  it("lista los items del roadmap", async () => {
    const { res, body } = await call(ItemsRoute, "GET", `/api/public/v1/roadmaps/${RID}/items`, {
      params: { roadmapId: RID },
    });
    expect(res.status).toBe(200);
    expect(body[0]).toMatchObject({ id: "E-1", type: "epic", quarter: "Q1" });
  });

  it("reemplaza el conjunto completo con PUT", async () => {
    const { res } = await call(ItemsRoute, "PUT", `/api/public/v1/roadmaps/${RID}/items`, {
      params: { roadmapId: RID },
      body: {
        items: [
          { uid: "n1", id: "US-1", type: "story", title: "Nueva", effort: 5, quarter: "Q2" },
        ],
      },
    });
    expect(res.status).toBe(200);
    const rows = tables.roadmap_items.filter((r) => r.roadmap_id === RID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item_code: "US-1", quarter: "Q2" });
  });

  it("valida el cuerpo y devuelve 400 si un item es inválido", async () => {
    const { res, body } = await call(ItemsRoute, "PUT", `/api/public/v1/roadmaps/${RID}/items`, {
      params: { roadmapId: RID },
      body: { items: [{ uid: "n1", type: "banana", title: "Mala" }] },
    });
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });
});

describe("/api/public/v1/roadmaps/:id/capacity", () => {
  it("devuelve la capacidad (por defecto si no hay fila) y la guarda con PUT", async () => {
    const got = await call(CapacityRoute, "GET", `/api/public/v1/roadmaps/${RID}/capacity`, {
      params: { roadmapId: RID },
    });
    expect(got.res.status).toBe(200);
    expect(got.body.developers).toBeGreaterThan(0);

    const saved = await call(CapacityRoute, "PUT", `/api/public/v1/roadmaps/${RID}/capacity`, {
      params: { roadmapId: RID },
      body: { capacity: { ...got.body, developers: 9 } },
    });
    expect(saved.res.status).toBe(200);
    expect(tables.roadmap_capacity[0]).toMatchObject({ developers: 9 });
  });
});

describe("/api/public/v1/stats", () => {
  it("agrega las métricas del workspace", async () => {
    const { res, body } = await call(StatsRoute, "GET", "/api/public/v1/stats");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ roadmapsCount: 1, totalItems: 1 });
    expect(body.byType).toEqual({ epic: 1, feature: 0, story: 0 });
  });

  it("acepta el filtro ?roadmapId", async () => {
    const { res, body } = await call(
      StatsRoute,
      "GET",
      `/api/public/v1/stats?roadmapId=${RID}`,
    );
    expect(res.status).toBe(200);
    expect(body.totalItems).toBe(1);
  });
});

describe("autorización por scopes de API key", () => {
  it("403 cuando la API key no tiene el scope de escritura", async () => {
    currentCtx = {
      ...createTestCtx(tables),
      authMethod: "api_key",
      scopes: ["roadmaps:read"],
    };
    const read = await call(RoadmapsRoute, "GET", "/api/public/v1/roadmaps");
    expect(read.res.status).toBe(200);

    const write = await call(RoadmapsRoute, "POST", "/api/public/v1/roadmaps", { body: {} });
    expect(write.res.status).toBe(403);
    expect(write.body.error.code).toBe("forbidden");
  });

  it("403 al gestionar API keys con una API key (requiere sesión)", async () => {
    currentCtx = {
      ...createTestCtx(tables),
      authMethod: "api_key",
      scopes: ["roadmaps:read", "roadmaps:write"],
    };
    const { res, body } = await call(ApiKeysRoute, "GET", "/api/public/v1/api-keys");
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });
});
