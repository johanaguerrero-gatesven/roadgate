/**
 * =============================================================================
 * Fase 5 · E2E — recorrido público y contrato de la API
 * =============================================================================
 * No requiere sesión: comprueba que la landing carga, que la navegación a
 * login/registro funciona y que la API pública anuncia su contrato OpenAPI y
 * protege sus endpoints.
 */
import { test, expect } from "@playwright/test";

test.describe("Recorrido público", () => {
  test("la landing carga con su título y CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveTitle(/roadgate/i);
  });

  test("desde la landing se llega al login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in|iniciar sesión|log ?in/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /probar demo/i })).toBeVisible();
  });

  test("la documentación de la API es navegable", async ({ page }) => {
    await page.goto("/docs/api");
    await expect(page.locator("body")).toContainText(/roadgate/i, { timeout: 20_000 });
  });
});

test.describe("API pública v1", () => {
  test("expone la especificación OpenAPI sin autenticación", async ({ request }) => {
    const res = await request.get("/api/public/v1/openapi.json");
    expect(res.status()).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/roadmaps", "/roadmaps/{roadmapId}/items", "/stats"]),
    );
  });

  test("responde 401 sin credenciales", async ({ request }) => {
    const res = await request.get("/api/public/v1/roadmaps");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
  });

  test("responde 401 con un token inválido", async ({ request }) => {
    const res = await request.get("/api/public/v1/roadmaps", {
      headers: { authorization: "Bearer no-es-un-token" },
    });
    expect(res.status()).toBe(401);
  });

  test("el preflight CORS está permitido", async ({ request }) => {
    // En dev, el propio servidor de Vite responde al preflight, así que sólo se
    // afirma el 204 y que se anuncian los métodos permitidos.
    const res = await request.fetch("/api/public/v1/roadmaps", { method: "OPTIONS" });
    expect(res.status()).toBe(204);
    expect(res.headers()["access-control-allow-methods"]).toContain("GET");
  });
});
