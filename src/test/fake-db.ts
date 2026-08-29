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
 * insert(), upsert(), update(), delete(). Cada builder es "thenable", igual que el
 * cliente real, y resuelve a `{ data, error }`.
 */
import type { RoadGateContext, RoadGateDb } from "@/core/context";

export type Tables = Record<string, Record<string, unknown>[]>;

type Filter = { op: "eq" | "in" | "is"; col: string; value: unknown };

function applyFilters(rows: Record<string, unknown>[], filters: Filter[]) {
  return rows.filter((r) =>
    filters.every((f) =>
      f.op === "eq"
        ? r[f.col] === f.value
        : f.op === "is"
          ? (r[f.col] ?? null) === (f.value ?? null)
          : (f.value as unknown[]).includes(r[f.col]),
    ),
  );
}

/**
 * Crea un doble de `RoadGateDb` sobre datos en memoria.
 * @param tables estado inicial (se muta, para poder afirmar sobre escrituras).
 * @returns el cliente falso y utilidades de inspección.
 */
export function createFakeDb(
  tables: Tables,
  currentUserId = "user-1",
  currentEmail = "demo@roadgate.test",
) {
  const calls: { table: string; action: string }[] = [];

  function builder(table: string) {
    const filters: Filter[] = [];
    let action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    let payload: Record<string, unknown>[] = [];
    let conflictColumns: string[] = [];
    let limit: number | null = null;
    let order: { col: string; asc: boolean } | null = null;
    let single: "one" | "maybe" | null = null;
    let embeds: string[] = [];

    const rowsOf = () => (tables[table] ??= []);

    /** Resuelve relaciones embebidas del estilo `teams(id, name)`. */
    const withEmbeds = (rows: Record<string, unknown>[]) =>
      rows.map((r) => {
        const out = { ...r };
        for (const rel of embeds) {
          const fk = `${rel.replace(/s$/, "")}_id`;
          out[rel] = (tables[rel] ?? []).find((x) => x.id === r[fk]) ?? null;
        }
        return out;
      });

    const run = (): { data: unknown; error: { message: string } | null } => {
      calls.push({ table, action });
      if (action === "delete") {
        const keep = rowsOf().filter((r) => !applyFilters([r], filters).length);
        tables[table] = keep;
        return { data: null, error: null };
      }
      if (action === "insert") {
        const inserted = payload.map((r, i) => ({
          id: (r.id as string) ?? crypto.randomUUID(),
          created_at: new Date(2026, 0, 1).toISOString(),
          ...r,
        }));
        rowsOf().push(...inserted);
        return finalize(inserted);
      }
      if (action === "upsert") {
        const saved = payload.map((incoming, i) => {
          const existing = rowsOf().find((row) =>
            conflictColumns.every((column) => row[column] === incoming[column]),
          );
          if (existing) {
            Object.assign(existing, incoming);
            return existing;
          }
          const inserted = {
            id: (incoming.id as string) ?? crypto.randomUUID(),
            created_at: new Date(2026, 0, 1).toISOString(),
            ...incoming,
          };
          rowsOf().push(inserted);
          return inserted;
        });
        return finalize(saved);
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
      return finalize(embeds.length ? withEmbeds(data) : data);
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
      select(cols?: string) {
        if (action === "select") action = "select";
        embeds = [...(cols ?? "").matchAll(/(\w+)\s*\(/g)].map((m) => m[1] as string);
        return api;
      },
      insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
        action = "insert";
        payload = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      upsert(
        rows: Record<string, unknown> | Record<string, unknown>[],
        options?: { onConflict?: string },
      ) {
        action = "upsert";
        payload = Array.isArray(rows) ? rows : [rows];
        conflictColumns = (options?.onConflict ?? "id").split(",").map((column) => column.trim());
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
      is(col: string, value: unknown) {
        filters.push({ op: "is", col, value });
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

  /** Doble de las funciones RPC de Postgres usadas por el core. */
  function rpc(name: string, args?: Record<string, unknown>) {
    if (name === "accept_team_invitation") {
      // Réplica de la función SQL: valida y da de alta como 'member'.
      const invitations = (tables["team_invitations"] ??= []);
      const members = (tables["team_members"] ??= []);
      const inv = invitations.find((i) => i.token_hash === args?.["_token_hash"]);
      const fail = (message: string) => Promise.resolve({ data: null, error: { message } });
      if (!inv) return fail("invitation_not_found");
      if (inv.revoked_at) return fail("invitation_revoked");
      if (new Date(inv.expires_at as string).getTime() < Date.now()) return fail("invitation_expired");
      if (inv.email !== currentEmail.toLowerCase()) return fail("invitation_email_mismatch");
      const already = members.find((m) => m.team_id === inv.team_id && m.user_id === currentUserId);
      if (inv.accepted_at) {
        if (already) return Promise.resolve({ data: inv.team_id, error: null });
        return fail("invitation_already_used");
      }
      if (already) {
        already.status = "active";
      } else {
        members.push({
          id: crypto.randomUUID(),
          team_id: inv.team_id,
          user_id: currentUserId,
          email: currentEmail.toLowerCase(),
          role: "member",
          status: "active",
          created_at: new Date(2026, 0, 2).toISOString(),
        });
      }
      inv.accepted_at = new Date().toISOString();
      return Promise.resolve({ data: inv.team_id, error: null });
    }
    if (name !== "ensure_personal_team") {
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    }
    const members = (tables["team_members"] ??= []);
    const teams = (tables["teams"] ??= []);
    const existing = members.find((m) => m.user_id === currentUserId && m.status === "active");
    if (existing) return Promise.resolve({ data: existing.team_id, error: null });
    const teamId = crypto.randomUUID();
    teams.push({
      id: teamId,
      name: `${currentUserId} team`,
      created_by: currentUserId,
      status: "active",
      plan: "free",
      seat_limit: 5,
    });
    members.push({
      id: crypto.randomUUID(),
      team_id: teamId,
      user_id: currentUserId,
      email: currentEmail.toLowerCase(),
      role: "admin",
      status: "active",
      created_at: new Date(2026, 0, 1).toISOString(),
    });
    return Promise.resolve({ data: teamId, error: null });
  }

  const db = { from: (table: string) => builder(table), rpc } as unknown as RoadGateDb;
  return { db, tables, calls };
}

/** Contexto de test con un usuario fijo y la BD falsa inyectada. */
export function createTestCtx(
  tables: Tables,
  userId = "user-1",
  email = "demo@roadgate.test",
): RoadGateContext & { tables: Tables } {
  const { db } = createFakeDb(tables, userId, email);
  return { db, userId, email, authMethod: "session", tables };
}

