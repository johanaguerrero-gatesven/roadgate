import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Configuración de tests.
 *
 * Dos proyectos, porque el coste de arrancar un DOM sólo se paga donde hace falta:
 *   - `unit` (Node): dominio (`src/lib/roadmap.ts`), servicios del core y
 *     adaptadores REST. Puro y rápido.
 *   - `ui` (jsdom): componentes React del módulo Roadmap (`*.dom.test.tsx`),
 *     con Testing Library y los matchers de jest-dom.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["**/node_modules/**", "src/**/*.dom.test.tsx"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.dom.test.tsx"],
          setupFiles: ["src/test/setup-dom.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/roadmap.ts",
        "src/core/**/*.ts",
        "src/lib/rest/**/*.ts",
        "src/features/roadmap/**/*.tsx",
      ],
      reporter: ["text", "html"],
    },
  },
});
