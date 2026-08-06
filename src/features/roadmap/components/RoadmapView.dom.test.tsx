/**
 * =============================================================================
 * Fase 4 · Tests de UI — RoadmapView
 * =============================================================================
 * Verifica el comportamiento observable del tablero trimestral:
 *   - qué tarjetas se pintan en cada Quarter (roll-up de padres),
 *   - la zona de "sin Quarter" separada por tipo,
 *   - el drag & drop nativo HTML5 y el banner de deshacer,
 *   - el cambio de Quarter desde el desplegable de la tarjeta.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { render, testCapacity, testItems } from "@/test/render";
import { RoadmapView } from "./RoadmapView";

/** Datos mínimos para simular un drag & drop nativo entre dos nodos. */
function dragAndDrop(source: Element, target: Element) {
  fireEvent.dragStart(source);
  fireEvent.dragOver(target);
  fireEvent.drop(target);
  fireEvent.dragEnd(source);
}

function setup(overrides: Partial<Parameters<typeof RoadmapView>[0]> = {}) {
  const onMove = vi.fn();
  const onRestore = vi.fn();
  const onUpdate = vi.fn();
  const utils = render(
    <RoadmapView
      items={testItems()}
      cfg={testCapacity}
      onMove={onMove}
      onRestore={onRestore}
      onUpdate={onUpdate}
      {...overrides}
    />,
  );
  return { ...utils, onMove, onRestore, onUpdate };
}

describe("RoadmapView", () => {
  it("pinta las cuatro columnas de Quarter", () => {
    setup();
    ["Q1", "Q2", "Q3", "Q4"].forEach((q) => {
      expect(screen.getByRole("heading", { name: q })).toBeInTheDocument();
    });
  });

  it("muestra sólo el ancestro cuando toda la rama está en el mismo Quarter", () => {
    setup();
    // E-1, F-1 y US-1 están todos en Q1 → se pinta el Epic (con sus hijos anidados),
    // nunca los hijos como tarjetas independientes de primer nivel.
    expect(screen.getAllByText("E-1").length).toBeGreaterThan(0);
    expect(screen.getByText("Epic uno")).toBeInTheDocument();
  });

  it("suma el esfuerzo de los descendientes en el KPI del Quarter", () => {
    setup();
    // US-1 aporta 20h; el resto de la rama no tiene esfuerzo propio.
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("agrupa los items sin Quarter en columnas por tipo", () => {
    setup();
    const section = document.getElementById("unassigned-section")!;
    expect(within(section).getByText("Epics")).toBeInTheDocument();
    expect(within(section).getByText("Features")).toBeInTheDocument();
    expect(within(section).getByText("User Stories")).toBeInTheDocument();
    expect(within(section).getByText(/US-2 · Historia sin planificar/)).toBeInTheDocument();
  });

  it("al arrastrar una tarjeta a un Quarter llama a onMove y ofrece deshacer", () => {
    const { onMove, onRestore } = setup();

    const card = screen.getByText(/US-2 · Historia sin planificar/).closest("[draggable]")!;
    const q2 = screen.getByRole("heading", { name: "Q2" }).closest("div.rounded-xl")!;
    dragAndDrop(card, q2);

    expect(onMove).toHaveBeenCalledWith("u-us2", "Q2");

    // Banner de deshacer: restaura el snapshot previo al movimiento.
    const undo = screen.getByRole("button", { name: /undo|deshacer/i });
    fireEvent.click(undo);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore.mock.calls[0][0]).toHaveLength(4);
  });

  it("no permite soltar un tipo distinto en la columna de backlog de un tipo", () => {
    const { onMove } = setup();
    const section = document.getElementById("unassigned-section")!;
    const epicsColumn = within(section).getByText("Epics").closest("div.rounded-xl")!;

    const story = screen.getByText(/US-2 · Historia sin planificar/).closest("[draggable]")!;
    dragAndDrop(story, epicsColumn);

    expect(onMove).not.toHaveBeenCalled();
  });

  it("abre el detalle del item al hacer clic en una tarjeta", () => {
    setup();
    fireEvent.click(screen.getByText("Epic uno"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
