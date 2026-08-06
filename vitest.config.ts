import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Configuración de tests (Fase 1 de la estrategia de testing).
 * Sólo se ejecutan tests de Node/JSDOM-free por ahora: el objetivo de esta fase
 * es cubrir el dominio (`src/lib/roadmap.ts`) y los servicios del core, que son
 * puros o dependen únicamente del puerto de persistencia (fácil de falsear).
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/roadmap.ts", "src/core/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
});
