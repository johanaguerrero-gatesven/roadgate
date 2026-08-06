/**
 * Utilidades compartidas por los tests de componentes (`*.dom.test.tsx`):
 * un `render` que monta los proveedores que la app usa en producción y unas
 * fixtures de dominio (Epic → Feature → User Story) reutilizables.
 */
import type { ReactElement, ReactNode } from "react";
import { render as rtlRender } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CapacityConfig, RoadmapItem } from "@/lib/roadmap";
import { defaultCapacity } from "@/lib/roadmap";

function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </I18nProvider>
  );
}

/** `render` de Testing Library con los proveedores de la app ya montados. */
export function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

/** Capacidad determinista: 4 quarters iguales, fácil de razonar en asserts. */
export const testCapacity: CapacityConfig = {
  ...defaultCapacity,
  developers: 2,
  dedicationPct: 100,
  daysPerSprint: 10,
  hoursPerDay: 5,
  sprintsPerQuarter: 5,
  sprintsByQuarter: {},
  hoursByQuarter: {},
};

/**
 * Árbol de ejemplo:
 *   E-1 (epic, Q1)
 *     └── F-1 (feature, Q1, 20h)
 *           └── US-1 (story, Q1, 20h)
 *   US-2 (story, sin quarter, 8h) → cae en el backlog
 */
export function testItems(): RoadmapItem[] {
  return [
    { uid: "u-e1", id: "E-1", type: "epic", title: "Epic uno", quarter: "Q1", priority: "1-High" },
    {
      uid: "u-f1",
      id: "F-1",
      type: "feature",
      title: "Feature uno",
      parentId: "E-1",
      quarter: "Q1",
      priority: "1-High",
    },
    {
      uid: "u-us1",
      id: "US-1",
      type: "story",
      title: "Historia uno",
      parentId: "F-1",
      quarter: "Q1",
      effort: 20,
      priority: "1-High",
    },
    {
      uid: "u-us2",
      id: "US-2",
      type: "story",
      title: "Historia sin planificar",
      effort: 8,
      priority: "3-Low",
    },
  ];
}
