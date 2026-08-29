/**
 * Tests de los servicios del core con el puerto de persistencia falseado.
 * Se centran en las reglas que el core garantiza por sí mismo (autorización
 * por `user_id`, forma de los DTOs y audit trail), sin depender de RLS.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestCtx, type Tables } from "@/test/fake-db";
import { NotFoundError, ValidationError } from "@/core/errors";
import {
  createRoadmap,
  deleteRoadmap,
  getRoadmap,
  listRoadmaps,
  renameRoadmap,
  resetRoadmap,
} from "@/core/services/roadmap-service";
import { listItems, replaceItems } from "@/core/services/item-service";
import {
  getCapacity,
  listCapacityHistory,
  saveCapacity,
} from "@/core/services/capacity-service";
import { getWorkspaceStats } from "@/core/services/stats-service";
import { defaultCapacity } from "@/lib/roadmap";

const RID = "11111111-1111-4111-8111-111111111111";
const OTHER_RID = "22222222-2222-4222-8222-222222222222";

function seed(): Tables {
  return {
    roadmaps: [
      { id: RID, user_id: "user-1", name: "Mi roadmap", created_at: "2026-01-01", updated_at: "2026-01-02" },
      { id: OTHER_RID, user_id: "user-2", name: "Ajeno", created_at: "2026-01-01", updated_at: "2026-01-02" },
    ],
    roadmap_items: [
      {
        id: "row-1",
        roadmap_id: RID,
        user_id: "user-1",
        item_uid: "u1",
        item_code: "E-1",
        type: "epic",
        title: "Epic uno",
        description: null,
        parent_id: null,
        effort: 10,
        priority: "1-High",
        quarter: "Q1",
        sprint: null,
        state: "Backlog",
        notes: null,
        tags: null,
        display_mode: null,
        hidden_from_roadmap: false,
      },
      {
        id: "row-2",
        roadmap_id: OTHER_RID,
        user_id: "user-2",
        item_uid: "u9",
        item_code: "E-9",
        type: "story",
        title: "De otro",
        description: null,
        parent_id: null,
        effort: 4,
        priority: null,
        quarter: null,
        sprint: null,
        state: null,
        notes: null,
        tags: null,
        display_mode: null,
        hidden_from_roadmap: false,
      },
    ],
    roadmap_capacity: [],
    roadmap_capacity_history: [],
  };
}

let tables: Tables;
let ctx: ReturnType<typeof createTestCtx>;

beforeEach(() => {
  tables = seed();
  ctx = createTestCtx(tables);
});

describe("roadmap-service", () => {
  it("lista sólo los roadmaps del actor con su número de items", async () => {
    const list = await listRoadmaps(ctx);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: RID, name: "Mi roadmap", itemCount: 1 });
  });

  it("crea un roadmap con nombre por defecto si no se indica", async () => {
    const { id } = await createRoadmap(ctx, {});
    const created = tables.roadmaps.find((r) => r.id === id);
    expect(created?.name).toBe("Hoja de ruta sin título");
    expect(created?.user_id).toBe("user-1");
  });

  it("renombra un roadmap propio", async () => {
    await renameRoadmap(ctx, { roadmapId: RID, name: "Nuevo nombre" });
    expect(tables.roadmaps.find((r) => r.id === RID)?.name).toBe("Nuevo nombre");
  });

  it("bloquea el acceso a un roadmap de otro usuario", async () => {
    await expect(renameRoadmap(ctx, { roadmapId: OTHER_RID, name: "Hack" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(getRoadmap(ctx, { roadmapId: OTHER_RID })).rejects.toBeInstanceOf(NotFoundError);
    expect(tables.roadmaps.find((r) => r.id === OTHER_RID)?.name).toBe("Ajeno");
  });

  it("carga el roadmap completo con items y capacidad por defecto", async () => {
    const detail = await getRoadmap(ctx, { roadmapId: RID });
    expect(detail.roadmap).toEqual({ id: RID, name: "Mi roadmap" });
    expect(detail.items[0]).toMatchObject({ id: "E-1", type: "epic", quarter: "Q1", effort: 10 });
    expect(detail.capacity).toEqual(defaultCapacity);
  });

  it("resetRoadmap vacía items y capacidad pero conserva la cabecera", async () => {
    await resetRoadmap(ctx, { roadmapId: RID });
    expect(tables.roadmap_items.filter((i) => i.roadmap_id === RID)).toHaveLength(0);
    expect(tables.roadmaps.some((r) => r.id === RID)).toBe(true);
  });

  it("deleteRoadmap borra la cabecera del actor", async () => {
    await deleteRoadmap(ctx, { roadmapId: RID });
    expect(tables.roadmaps.some((r) => r.id === RID)).toBe(false);
  });

  it("rechaza ids que no son UUID", async () => {
    await expect(getRoadmap(ctx, { roadmapId: "abc" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("item-service", () => {
  it("lista los items del roadmap ya mapeados a dominio", async () => {
    const items = await listItems(ctx, { roadmapId: RID });
    expect(items).toHaveLength(1);
    expect(items[0].uid).toBe("u1");
  });

  it("replaceItems sustituye el snapshot completo", async () => {
    const res = await replaceItems(ctx, {
      roadmapId: RID,
      items: [
        { uid: "n1", id: "F-1", type: "feature", title: "Nueva feature", effort: 8, quarter: "Q2" },
      ],
    });
    expect(res).toEqual({ ok: true, count: 1 });
    const rows = tables.roadmap_items.filter((r) => r.roadmap_id === RID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item_code: "F-1", quarter: "Q2", user_id: "user-1" });
  });

  it("un snapshot vacío deja el roadmap sin items", async () => {
    await replaceItems(ctx, { roadmapId: RID, items: [] });
    expect(tables.roadmap_items.filter((r) => r.roadmap_id === RID)).toHaveLength(0);
    // No toca los items de otros roadmaps.
    expect(tables.roadmap_items.filter((r) => r.roadmap_id === OTHER_RID)).toHaveLength(1);
  });

  it("no permite escribir en un roadmap ajeno", async () => {
    await expect(
      replaceItems(ctx, { roadmapId: OTHER_RID, items: [] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("capacity-service", () => {
  const cfg = {
    developers: 5,
    dedicationPct: 50,
    daysPerSprint: 10,
    hoursPerDay: 8,
    sprintsPerQuarter: 6,
    sprintsByQuarter: {},
    hoursByQuarter: { Q1: 500 },
  };

  it("devuelve la capacidad por defecto si aún no se configuró", async () => {
    expect(await getCapacity(ctx, { roadmapId: RID })).toEqual(defaultCapacity);
  });

  it("guarda la capacidad y la relee igual", async () => {
    await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    expect(await getCapacity(ctx, { roadmapId: RID })).toEqual(cfg);
    expect(tables.roadmap_capacity).toHaveLength(1);
  });

  it("usa una escritura atómica sin borrar previamente la capacidad", async () => {
    await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    await saveCapacity(ctx, { roadmapId: RID, capacity: { ...cfg, developers: 8 } });

    expect(tables.roadmap_capacity).toHaveLength(1);
    expect(tables.roadmap_capacity[0]).toMatchObject({ roadmap_id: RID, developers: 8 });
    expect(ctx.tables.roadmap_capacity).toHaveLength(1);
  });

  it("permite que el mismo actor guarde capacidad en dos roadmaps", async () => {
    tables.roadmaps.push({
      id: "33333333-3333-4333-8333-333333333333",
      user_id: "user-1",
      name: "Segundo roadmap",
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
    });

    await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    await saveCapacity(ctx, {
      roadmapId: "33333333-3333-4333-8333-333333333333",
      capacity: { ...cfg, developers: 9 },
    });

    expect(tables.roadmap_capacity).toHaveLength(2);
    expect(new Set(tables.roadmap_capacity.map((row) => row.roadmap_id))).toEqual(
      new Set([RID, "33333333-3333-4333-8333-333333333333"]),
    );
  });

  it("registra en el audit trail sólo los campos que cambian", async () => {
    await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    const second = await saveCapacity(ctx, {
      roadmapId: RID,
      capacity: { ...cfg, developers: 6 },
    });
    expect(second.logged).toBe(1);
    const last = tables.roadmap_capacity_history.at(-1);
    expect(last).toMatchObject({
      field: "developers",
      old_value: "5",
      new_value: "6",
      changed_by_email: "demo@roadgate.test",
    });
  });

  it("no genera ruido cuando se guarda lo mismo dos veces", async () => {
    await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    const again = await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    expect(again.logged).toBe(0);
  });

  it("expone el histórico adaptado a la vista", async () => {
    await saveCapacity(ctx, { roadmapId: RID, capacity: cfg });
    const history = await listCapacityHistory(ctx, { roadmapId: RID });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty("by", "demo@roadgate.test");
    expect(history[0]).toHaveProperty("field");
  });
});

describe("stats-service", () => {
  it("agrega los items de todos los roadmaps del actor", async () => {
    const stats = await getWorkspaceStats(ctx, {});
    expect(stats.roadmapsCount).toBe(1);
    expect(stats.totalItems).toBe(1);
    expect(stats.byType).toEqual({ epic: 1, feature: 0, story: 0 });
  });

  it("acota las métricas al roadmap seleccionado", async () => {
    const stats = await getWorkspaceStats(ctx, { roadmapId: RID });
    expect(stats.totalItems).toBe(1);
  });

  it("ignora un roadmap ajeno en el filtro en vez de fallar", async () => {
    const stats = await getWorkspaceStats(ctx, { roadmapId: OTHER_RID });
    expect(stats.totalItems).toBe(1);
    expect(stats.roadmapsCount).toBe(1);
  });
});
