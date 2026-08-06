/**
 * =============================================================================
 * Fase 4 · Tests de UI — PriorityPicker
 * =============================================================================
 * El selector compacto de prioridad es el punto de entrada de una regla de
 * negocio importante (bajar la prioridad devuelve el item al backlog), así que
 * se comprueba que notifica el cambio exactamente una vez y con el valor real.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "@/test/render";
import { PriorityPicker } from "./PriorityPicker";

describe("PriorityPicker", () => {
  it("muestra el estado sin prioridad cuando no hay valor", () => {
    render(<PriorityPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("muestra la abreviatura de la prioridad actual", () => {
    render(<PriorityPicker value="1-High" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();
  });

  it("abre las cuatro opciones y notifica el cambio", async () => {
    const onChange = vi.fn();
    render(<PriorityPicker value="1-High" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    const options = await screen.findAllByRole("option");
    // 4 prioridades reales + "sin prioridad".
    expect(options.length).toBeGreaterThanOrEqual(5);

    fireEvent.click(options.find((o) => o.textContent?.match(/low/i) && !o.textContent?.match(/lowest/i))!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe("3-Low");
  });

  it("no emite onChange si se reselecciona el mismo valor", async () => {
    const onChange = vi.fn();
    render(<PriorityPicker value="1-High" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    const options = await screen.findAllByRole("option");
    fireEvent.click(options.find((o) => o.getAttribute("data-state") === "checked")!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
