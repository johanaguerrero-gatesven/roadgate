/**
 * =============================================================================
 * Fase 3 · Tests del contrato de transporte REST
 * =============================================================================
 * Cubre las piezas transversales de `/api/public/v1/*` sin pasar por ninguna
 * ruta concreta: normalización de respuestas y errores (`respond.ts`) y las
 * reglas de autenticación/autorización del adaptador (`context.ts`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { json, preflight, toErrorResponse, readJson, handle } from "./respond";
import { createRestContext, requireScope, requireSession } from "./context";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/core";
import type { RoadGateContext } from "@/core";

const baseCtx = { db: {} as never, userId: "user-1" };

beforeEach(() => {
  // El adaptador lee la configuración dentro del handler (runtime serverless).
  process.env["SUPABASE_URL"] = "https://example.supabase.co";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";
});

describe("respond", () => {
  it("serializa JSON con el status y las cabeceras CORS", async () => {
    const res = json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("responde 204 sin cuerpo al preflight", () => {
    expect(preflight().status).toBe(204);
  });

  it("traduce errores de dominio a su status y code", async () => {
    const notFound = toErrorResponse(new NotFoundError("Roadmap no encontrado"));
    expect(notFound.status).toBe(404);
    expect((await notFound.json()).error).toMatchObject({
      code: "not_found",
      message: "Roadmap no encontrado",
    });

    const invalid = toErrorResponse(new ValidationError("Datos inválidos", { field: "name" }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.details).toEqual({ field: "name" });
  });

  it("oculta los errores inesperados tras un 500 genérico", async () => {
    const res = toErrorResponse(new Error("password=hunter2"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });

  it("handle() captura las excepciones del caso de uso", async () => {
    const res = await handle(async () => {
      throw new ForbiddenError("nope");
    });
    expect(res.status).toBe(403);
  });

  it("readJson tolera cuerpos vacíos o malformados", async () => {
    expect(await readJson(new Request("https://x.test", { method: "POST" }))).toEqual({});
    expect(
      await readJson(new Request("https://x.test", { method: "POST", body: "{no-json" })),
    ).toEqual({});
    expect(
      await readJson(new Request("https://x.test", { method: "POST", body: '{"a":1}' })),
    ).toEqual({ a: 1 });
  });
});

describe("createRestContext", () => {
  const call = (headers: Record<string, string>) =>
    createRestContext(new Request("https://roadgate.test/api/public/v1/roadmaps", { headers }));

  it("401 si falta la cabecera Authorization", async () => {
    await expect(call({})).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("401 si el esquema no es Bearer", async () => {
    await expect(call({ authorization: "Basic abc" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("401 si el bearer viene vacío", async () => {
    await expect(call({ authorization: "Bearer    " })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("401 si el token no tiene forma de JWT", async () => {
    await expect(call({ authorization: "Bearer no-es-un-jwt" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("requireScope / requireSession", () => {
  const session: RoadGateContext = { ...baseCtx, authMethod: "session" };
  const apiKey: RoadGateContext = {
    ...baseCtx,
    authMethod: "api_key",
    scopes: ["roadmaps:read"],
  };

  it("una sesión de usuario tiene todos los permisos", () => {
    expect(() => requireScope(session, "roadmaps:write")).not.toThrow();
    expect(() => requireSession(session)).not.toThrow();
  });

  it("una API key sólo puede usar sus scopes", () => {
    expect(() => requireScope(apiKey, "roadmaps:read")).not.toThrow();
    expect(() => requireScope(apiKey, "roadmaps:write")).toThrow(ForbiddenError);
  });

  it("una API key no puede gestionar API keys", () => {
    expect(() => requireSession(apiKey)).toThrow(ForbiddenError);
  });
});
