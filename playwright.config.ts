import { defineConfig, devices } from "@playwright/test";

/**
 * =============================================================================
 * Fase 5 · Configuración de los tests end-to-end
 * =============================================================================
 * Los E2E arrancan (o reutilizan) el servidor de desarrollo y ejercitan la app
 * como lo haría una persona: navegación pública, documentación de la API y el
 * flujo crítico con la cuenta demo.
 *
 * Ejecutar:  npm run test:e2e        (headless)
 *            npm run test:e2e:ui     (modo interactivo)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Escape hatch para contenedores que ya traen su propio Chromium.
        ...(process.env["E2E_CHROMIUM_PATH"]
          ? { launchOptions: { executablePath: process.env["E2E_CHROMIUM_PATH"] } }
          : {}),
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
