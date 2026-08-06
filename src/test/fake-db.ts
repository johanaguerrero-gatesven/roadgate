/**
 * =============================================================================
 * Doble de test del puerto de persistencia (`RoadGateDb`)
 * =============================================================================
 * El core está diseñado para recibir su base de datos por inyección
 * (arquitectura hexagonal), así que para testear los servicios NO hace falta
 * levantar Supabase: basta con implementar el subconjunto del query builder de
 * PostgREST que los servicios usan realmente.
 *
 * Soportado: from().select().eq().in().order().limit().maybeSingle().single(),
 * insert(), update(), delete(). Cada builder es "thenable", igual que el
 * cliente real, y resuelve a `{ data, error }`.
 */
import type { RoadGateContext, RoadGateDb } from "@/core/context";

export type Tables = Record<string, Record<string, unknown>[]>;

type Filter = { op: "eq" | "in"; col: string; value: unknown };

function applyFilters(rows: Record<string, unknown>[], filters: Filter[]) {
  return rows.filter((r) =>
    filters.every((f) =>
      f.op === "eq" ? r[f.col] === f.value : (f.value as unknown[]).includes(r[f.col]),
    ),
  );
}

/**
 * Crea un doble de `RoadGateDb` sobre datos en memoria.
 * @param tables estado inicial (se muta, para poder afirmar sobre escrituras).
 * @returns el cliente falso y utilidades de inspección.
 */
export function createFakeDb(tables: Tables) {
  const calls: { table: string; action: string }[] = [];

  function builder(table: string) {
    const filters: Filter[] = [];
    let action: "select" | "insert" | "update" | "delete" = "select";
    let payload: Record<string, unknown>[] = [];
    let limit: number | null = null;
    let order: { col: string; asc: boolean } | null = null;
    let single: "one" | "maybe" | null = null;

    const rowsOf = () => (tables[table] ??= []);

    const run = (): { data: unknown; error: { message: string } | null } => {
      calls.push({ table, action });
      if (action === "delete") {
        const keep = rowsOf().filter((r) => !applyFilters([r], filters).length);
        tables[table] = keep;
        return { data: null, error: null };
      }
      if (action === "insert") {
        const inserted = payload.map((r, i) => ({
          id: (r.id as string) ?? `${table}-${rowsOf().length + i + 1}`,
          created_at: new Date(2026, 0, 1).toISOString(),
          ...r,
        }));
        rowsOf().push(...inserted);
        return finalize(inserted);
      }
      if (action === "update") {
        const matched = applyFilters(rowsOf(), filters);
        matched.forEach((r) => Object.assign(r, payload[0]));
        return finalize(matched);
      }
      let data = applyFilters(rowsOf(), filters).map((r) => ({ ...r }));
      if (order) {
        data.sort((a, b) => {
          const av = String(a[order!.col] ?? "");
          const bv = String(b[order!.col] ?? "");
          return order!.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limit != null) data = data.slice(0, limit);
      return finalize(data);
    };

    const finalize = (data: Record<string, unknown>[]) => {
      if (single === "one") {
        if (data.length !== 1) return { data: null, error: { message: "no rows" } };
        return { data: data[0], error: null };
      }
      if (single === "maybe") return { data: data[0] ?? null, error: null };
      return { data, error: null };
    };

    const api = {
      select() {
        if (action === "select") action = "select";
        return api;
      },
      insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
        action = "insert";
        payload = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      update(values: Record<string, unknown>) {
        action = "update";
        payload = [values];
        return api;
      },
      delete() {
        action = "delete";
        return api;
      },
      eq(col: string, value: unknown) {
        filters.push({ op: "eq", col, value });
        return api;
      },
      in(col: string, value: unknown[]) {
        filters.push({ op: "in", col, value });
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        order = { col, asc: opts?.ascending !== false };
        return api;
      },
      limit(n: number) {
        limit = n;
        return api;
      },
      maybeSingle() {
        single = "maybe";
        return api;
      },
      single() {
        single = "one";
        return api;
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (e) {
          return Promise.reject(e).catch(reject);
        }
      },
    };
    return api;
  }

  const db = { from: (table: string) => builder(table) } as unknown as RoadGateDb;
  return { db, tables, calls };
}

/** Contexto de test con un usuario fijo y la BD falsa inyectada. */
export function createTestCtx(tables: Tables, userId = "user-1"): RoadGateContext & {
  tables: Tables;
} {
  const { db } = createFakeDb(tables);
  return { db, userId, email: "demo@roadgate.test", authMethod: "session", tables };
}
