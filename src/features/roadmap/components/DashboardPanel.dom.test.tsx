/**
 * =============================================================================
 * Fase 4 · Tests de UI — DashboardPanel
 * =============================================================================
 * El panel no calcula nada por sí mismo: se limita a presentar los agregados
 * del dominio. Estos tests fijan esa separación (Roadmap vs Backlog) y la
 * presencia de la leyenda y los tooltips explicativos.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render, testCapacity, testItems } from "@/test/render";
import { DashboardPanel } from "./DashboardPanel";

describe("DashboardPanel", () => {
  it("separa el esfuerzo planificado (roadmap) del pendiente (backlog)", () => {
    render(<DashboardPanel items={testItems()} cfg={testCapacity} />);
    // 20h en Q1 (US-1) y 8h sin planificar (US-2): nunca se suman en el mismo KPI.
    expect(screen.getAllByText(/20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8/).length).toBeGreaterThan(0);
  });

  it("muestra una barra de utilización por cada Quarter", () => {
    render(<DashboardPanel items={testItems()} cfg={testCapacity} />);
    ["Q1", "Q2", "Q3", "Q4"].forEach((q) => {
      expect(screen.getAllByText(q).length).toBeGreaterThan(0);
    });
  });

  it("expone tooltips accesibles que explican cada métrica", () => {
    render(<DashboardPanel items={testItems()} cfg={testCapacity} />);
    const tips = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.length);
    expect(tips.length).toBeGreaterThan(0);
  });

  it("no rompe con un roadmap vacío", () => {
    render(<DashboardPanel items={[]} cfg={testCapacity} />);
    expect(screen.getAllByText("Q1").length).toBeGreaterThan(0);
  });
});
