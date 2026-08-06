/**
 * Tests del dominio puro (`src/lib/roadmap.ts`).
 * Es la capa con más reglas de negocio del producto (jerarquía RoadGates,
 * gate de priorización y motor de cálculo de capacidad), por eso es la primera
 * que se cubre.
 */
import { describe, expect, it } from "vitest";
import {
  annualCapacity,
  buildRoadmapView,
  capacityPerQuarter,
  capacityPerSprint,
  clearHoursOverrides,
  countByPriority,
  defaultCapacity,
  descendantsOf,
  effortByPriority,
  effortByQuarter,
  enforcePriorityInvariant,
  importCSV,
  isQuarterOverridden,
  normalizeItems,
  parseCSV,
  roadmapCoverage,
  rolledUpEffort,
  setAnnualCapacity,
  sprintsForQuarter,
  syncParentEfforts,
  syncParentQuarters,
  toCSV,
  topAncestor,
  type CapacityConfig,
  type Priority,
  type Quarter,
  type RoadmapItem,
} from "@/lib/roadmap";

/** Helper para construir work items con lo mínimo indispensable. */
function item(partial: Partial<RoadmapItem> & { id: string }): RoadmapItem {
  return {
    uid: partial.uid ?? `uid-${partial.id}`,
    type: partial.type ?? "story",
    title: partial.title ?? partial.id,
    ...partial,
  } as RoadmapItem;
}

/** Epic → 2 Features → 1 Story cada una. */
function tree(overrides: Record<string, Partial<RoadmapItem>> = {}): RoadmapItem[] {
  const base: RoadmapItem[] = [
    item({ id: "E1", type: "epic" }),
    item({ id: "F1", type: "feature", parentId: "E1" }),
    item({ id: "F2", type: "feature", parentId: "E1" }),
    item({ id: "S1", type: "story", parentId: "F1", effort: 10 }),
    item({ id: "S2", type: "story", parentId: "F2", effort: 30 }),
  ];
  return base.map((i) => ({ ...i, ...(overrides[i.id] ?? {}) }));
}

describe("jerarquía: descendientes y ancestros", () => {
  it("devuelve todos los descendientes de un epic", () => {
    const items = tree();
    const ids = descendantsOf(items[0], items).map((i) => i.id).sort();
    expect(ids).toEqual(["F1", "F2", "S1", "S2"]);
  });

  it("resuelve el ancestro raíz de una user story", () => {
    const items = tree();
    expect(topAncestor(items[3], items)?.id).toBe("E1");
  });

  it("no entra en bucle infinito con ciclos de parentId", () => {
    const items = [
      item({ id: "A", type: "epic", parentId: "B" }),
      item({ id: "B", type: "feature", parentId: "A" }),
    ];
    expect(() => descendantsOf(items[0], items)).not.toThrow();
    expect(() => topAncestor(items[0], items)).not.toThrow();
  });
});

describe("syncParentQuarters", () => {
  it("hereda el quarter del padre a una rama sin planificar", () => {
    const out = syncParentQuarters(tree({ E1: { quarter: "Q2" } }));
    expect(out.every((i) => i.quarter === "Q2")).toBe(true);
  });

  it("marca MULTI al padre cuando los hijos están en quarters distintos", () => {
    const out = syncParentQuarters(tree({ S1: { quarter: "Q1" }, S2: { quarter: "Q3" } }));
    const byId = Object.fromEntries(out.map((i) => [i.id, i]));
    expect(byId.E1.quarter).toBe("MULTI");
    expect(byId.F1.quarter).toBe("Q1");
    expect(byId.F2.quarter).toBe("Q3");
  });

  it("deja el padre sin quarter si ningún hijo está planificado", () => {
    const out = syncParentQuarters(tree());
    expect(out.find((i) => i.id === "E1")!.quarter ?? "").toBe("");
  });

  it("una hoja nunca puede quedar en MULTI", () => {
    const out = syncParentQuarters([item({ id: "S9", quarter: "MULTI" as Quarter })]);
    expect(out[0].quarter).toBe("");
  });
});

describe("enforcePriorityInvariant (gate de priorización)", () => {
  it("fuerza prioridad alta a un item planificado sin prioridad", () => {
    const out = enforcePriorityInvariant([item({ id: "S1", quarter: "Q1" })]);
    expect(out[0].priority).toBe("1-High");
  });

  it("hereda la prioridad del ancestro válido más cercano", () => {
    const items = [
      item({ id: "E1", type: "epic", quarter: "Q1", priority: "2-Medium" as Priority }),
      item({ id: "S1", parentId: "E1", quarter: "Q1", priority: "3-Low" as Priority }),
    ];
    expect(enforcePriorityInvariant(items)[1].priority).toBe("2-Medium");
  });

  it("degrada a baja cualquier item alto que esté en backlog", () => {
    const out = enforcePriorityInvariant([item({ id: "S1", priority: "1-High" as Priority })]);
    expect(out[0].priority).toBe("3-Low");
  });

  it("respeta los items sin prioridad en backlog", () => {
    const out = enforcePriorityInvariant([item({ id: "S1" })]);
    expect(out[0].priority ?? "").toBe("");
  });
});

describe("normalizeItems", () => {
  it("recalcula el esfuerzo del padre como suma de sus hojas", () => {
    const out = normalizeItems(tree({ E1: { effort: 999 } }));
    const byId = Object.fromEntries(out.map((i) => [i.id, i]));
    expect(byId.E1.effort).toBe(40);
    expect(byId.F1.effort).toBe(10);
    expect(byId.S1.effort).toBe(10);
  });

  it("no desborda con auto-referencias en parentId", () => {
    const items = [item({ id: "X", type: "epic", parentId: "X", effort: 5 })];
    expect(() => normalizeItems(items)).not.toThrow();
  });
});

describe("motor de capacidad", () => {
  const cap: CapacityConfig = { ...defaultCapacity };

  it("capacidad por sprint = devs x dedicación x días x horas", () => {
    // 7 devs * 30% * 10 días * 5 h = 105 h
    expect(capacityPerSprint(cap)).toBeCloseTo(105);
  });

  it("capacidad por quarter usa los sprints del quarter", () => {
    expect(capacityPerQuarter(cap, "Q1")).toBeCloseTo(525);
    const custom = { ...cap, sprintsByQuarter: { Q1: 2 } };
    expect(sprintsForQuarter(custom, "Q1")).toBe(2);
    expect(capacityPerQuarter(custom, "Q1")).toBeCloseTo(210);
  });

  it("el override de horas manda sobre el cálculo por sprints", () => {
    const custom = { ...cap, hoursByQuarter: { Q2: 400 } };
    expect(isQuarterOverridden(custom, "Q2")).toBe(true);
    expect(capacityPerQuarter(custom, "Q2")).toBe(400);
    expect(isQuarterOverridden(custom, "Q3")).toBe(false);
  });

  it("la capacidad anual es la suma de los cuatro quarters", () => {
    expect(annualCapacity(cap)).toBeCloseTo(2100);
  });

  it("setAnnualCapacity reparte a partes iguales y clearHoursOverrides revierte", () => {
    const set = setAnnualCapacity(cap, 4000);
    expect(set.hoursByQuarter).toEqual({ Q1: 1000, Q2: 1000, Q3: 1000, Q4: 1000 });
    expect(annualCapacity(set)).toBe(4000);
    expect(annualCapacity(clearHoursOverrides(set))).toBeCloseTo(2100);
  });

  it("nunca produce capacidad negativa", () => {
    expect(setAnnualCapacity(cap, -500).hoursByQuarter?.Q1).toBe(0);
  });
});

describe("agregados de roadmap", () => {
  it("effortByQuarter sólo cuenta hojas (no duplica el esfuerzo del padre)", () => {
    const items = normalizeItems(tree({ S1: { quarter: "Q1" }, S2: { quarter: "Q1" } }));
    const acc = effortByQuarter(items);
    expect(acc.Q1).toBe(40);
    expect(acc[""]).toBe(0);
  });

  it("ignora los items ocultos del roadmap", () => {
    const items = normalizeItems(
      tree({ S1: { quarter: "Q1", hiddenFromRoadmap: true }, S2: { quarter: "Q1" } }),
    );
    expect(effortByQuarter(items).Q1).toBe(30);
  });

  it("rolledUpEffort y syncParentEfforts coinciden", () => {
    const items = tree();
    expect(rolledUpEffort(items[0], items)).toBe(40);
    expect(syncParentEfforts(items).find((i) => i.id === "E1")!.effort).toBe(40);
  });

  it("roadmapCoverage mide el % de esfuerzo realmente planificado", () => {
    const items = tree({ S1: { quarter: "Q1" } });
    const cov = roadmapCoverage(items[0], items);
    expect(cov.total).toBe(40);
    expect(cov.planned).toBe(10);
    expect(cov.pct).toBeCloseTo(25);
  });

  it("countByPriority y effortByPriority separan lo no priorizado", () => {
    const items = [
      item({ id: "S1", priority: "1-High" as Priority, effort: 5 }),
      item({ id: "S2", effort: 7 }),
    ];
    expect(countByPriority(items)["1-High"]).toBe(1);
    expect(countByPriority(items)["Sin prioridad"]).toBe(1);
    expect(effortByPriority(items)["Sin prioridad"]).toBe(7);
  });
});

describe("buildRoadmapView (regla de rollup)", () => {
  it("muestra el padre cuando todos los hijos comparten quarter", () => {
    const items = normalizeItems(tree({ S1: { quarter: "Q1" }, S2: { quarter: "Q1" } }));
    const view = buildRoadmapView(items);
    expect(view.map((v) => v.item.id)).toEqual(["E1"]);
    expect(view[0].quarter).toBe("Q1");
    expect(view[0].rolledUp).toBe(true);
  });

  it("muestra los hijos cuando están repartidos entre quarters", () => {
    const items = normalizeItems(tree({ S1: { quarter: "Q1" }, S2: { quarter: "Q3" } }));
    const ids = buildRoadmapView(items).map((v) => v.item.id).sort();
    expect(ids).toEqual(["F1", "F2"]);
  });

  it("displayMode 'children' fuerza el desglose", () => {
    const items = normalizeItems(
      tree({ E1: { displayMode: "children" }, S1: { quarter: "Q1" }, S2: { quarter: "Q1" } }),
    );
    const ids = buildRoadmapView(items).map((v) => v.item.id);
    expect(ids).not.toContain("E1");
    expect(ids).toContain("F1");
  });

  it("excluye los items ocultos", () => {
    const items = normalizeItems(tree({ E1: { hiddenFromRoadmap: true } }));
    expect(buildRoadmapView(items)).toHaveLength(0);
  });
});

describe("CSV", () => {
  it("parsea comillas, comas y saltos de línea dentro del campo", () => {
    const rows = parseCSV('ID,Title\n"1","Hola, mundo"\n"2","Multi\nlínea"');
    expect(rows).toHaveLength(2);
    expect(rows[0].Title).toBe("Hola, mundo");
    expect(rows[1].Title).toContain("\n");
  });

  it("ignora el BOM inicial", () => {
    const rows = parseCSV("\uFEFFID,Title\n1,A");
    expect(Object.keys(rows[0])).toContain("ID");
  });

  it("importa filas como work items del tipo indicado", () => {
    const imported = importCSV("ID,Title,Effort\nE-1,Primer epic,20", "epic", []);
    expect(imported).toHaveLength(1);
    expect(imported[0].type).toBe("epic");
    expect(imported[0].title).toBe("Primer epic");
  });

  it("toCSV produce una cabecera y una fila por item", () => {
    const csv = toCSV([item({ id: "S1", type: "story", title: "Uno", effort: 3 })]);
    const lines = csv.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain("ID");
  });
});
