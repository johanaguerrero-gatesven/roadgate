/**
 * Tests de los esquemas de entrada del core.
 * Garantizan que ninguna entrada inválida llegue a un servicio y que los
 * errores salgan siempre como `ValidationError` (contrato con los adaptadores).
 */
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/core/errors";
import {
  capacityConfigSchema,
  createRoadmapInput,
  parseInput,
  renameRoadmapInput,
  replaceItemsInput,
  roadmapItemSchema,
  roadmapRefInput,
} from "@/core/schemas";

const RID = "11111111-1111-4111-8111-111111111111";

describe("parseInput", () => {
  it("traduce el fallo de Zod a ValidationError", () => {
    expect(() => parseInput(roadmapRefInput, { roadmapId: "no-uuid" })).toThrow(ValidationError);
  });

  it("acepta un UUID válido", () => {
    expect(parseInput(roadmapRefInput, { roadmapId: RID }).roadmapId).toBe(RID);
  });
});

describe("roadmapItemSchema", () => {
  const base = { uid: "u1", id: "E-1", type: "epic" as const };

  it("aplica el título por defecto", () => {
    expect(roadmapItemSchema.parse(base).title).toBe("");
  });

  it("rechaza esfuerzos negativos", () => {
    expect(roadmapItemSchema.safeParse({ ...base, effort: -1 }).success).toBe(false);
  });

  it("rechaza tipos fuera de la jerarquía RoadGates", () => {
    expect(roadmapItemSchema.safeParse({ ...base, type: "task" }).success).toBe(false);
  });

  it("acepta el quarter vacío (backlog) y MULTI", () => {
    expect(roadmapItemSchema.safeParse({ ...base, quarter: "" }).success).toBe(true);
    expect(roadmapItemSchema.safeParse({ ...base, quarter: "MULTI" }).success).toBe(true);
    expect(roadmapItemSchema.safeParse({ ...base, quarter: "Q5" }).success).toBe(false);
  });
});

describe("entradas por caso de uso", () => {
  it("createRoadmap permite nombre ausente", () => {
    expect(parseInput(createRoadmapInput, {})).toEqual({});
  });

  it("renameRoadmap rechaza nombre vacío", () => {
    expect(() => parseInput(renameRoadmapInput, { roadmapId: RID, name: "   " })).toThrow(
      ValidationError,
    );
  });

  it("replaceItems limita el tamaño del snapshot", () => {
    const many = Array.from({ length: 10001 }, (_, i) => ({
      uid: `u${i}`,
      id: `I-${i}`,
      type: "story" as const,
    }));
    expect(replaceItemsInput.safeParse({ roadmapId: RID, items: many }).success).toBe(false);
  });

  it("capacityConfig rechaza dedicación > 100%", () => {
    const cfg = {
      developers: 3,
      dedicationPct: 120,
      daysPerSprint: 10,
      hoursPerDay: 8,
      sprintsPerQuarter: 6,
    };
    expect(capacityConfigSchema.safeParse(cfg).success).toBe(false);
  });
});
