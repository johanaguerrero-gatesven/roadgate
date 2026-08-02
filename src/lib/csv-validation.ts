/**
 * =============================================================================
 * Validación de importaciones CSV / Excel
 * =============================================================================
 * Comprueba, ANTES de tocar el estado del roadmap, que el fichero:
 *  - trae las columnas obligatorias,
 *  - las trae en el orden esperado (aviso, no error: el parser mapea por nombre),
 *  - y que cada celda tiene el tipo/valor esperado (esfuerzo numérico,
 *    prioridad, quarter, estado, IDs únicos, padres existentes).
 * Devuelve un informe legible para mostrar al usuario.
 */
import { ItemType, Priority, Quarter, RoadmapItem, State, parseCSV } from "./roadmap";

export type IssueSeverity = "error" | "warning";

export type ImportIssue = {
  severity: IssueSeverity;
  row?: number;        // 1 = primera fila de datos (sin contar cabecera)
  column?: string;
  message: string;
};

export type ImportReport = {
  headers: string[];
  totalRows: number;
  validRows: number;
  issues: ImportIssue[];
  errorCount: number;
  warningCount: number;
  ok: boolean;         // sin errores bloqueantes
};

/** Estructura canónica por tipo (la misma que exporta la app). */
export const EXPECTED_COLUMNS: Record<ItemType, string[]> = {
  epic: ["ID", "Work Item Type", "Title", "Description", "Parent", "Effort", "Priority", "Quarter", "State", "Tags", "Notes"],
  story: ["ID", "Title", "Parent Type", "Parent ID", "Parent Title", "Effort (h)", "Priority", "Quarter", "Comments"],
  feature: ["ID", "Title", "EPIC ID", "EPIC Title", "Effort (h)", "Priority", "Quarter", "State", "Owner", "PBIs #", "Comments"],
};

/** Columnas sin las cuales la importación no tiene sentido. */
const REQUIRED: Record<ItemType, string[][]> = {
  epic: [["id"], ["title", "name", "summary"]],
  story: [["id"], ["title", "name", "summary"]],
  feature: [["id"], ["title", "name", "summary"]],
};

const PRIORITY_VALUES: Priority[] = ["1-High", "2-Medium", "3-Low", "4-Lowest", ""];
const STATE_VALUES: State[] = ["Backlog", "In Progress", "Done", "Blocked"];
const QUARTER_VALUES: Quarter[] = ["Q1", "Q2", "Q3", "Q4", "MULTI", ""];

const norm = (s: string) => s.toLowerCase().trim();

function findHeader(headers: string[], aliases: string[]): string | undefined {
  return headers.find((h) => aliases.some((a) => norm(h) === norm(a)));
}

function cell(row: Record<string, string>, aliases: string[]): { key?: string; value: string } {
  for (const k of Object.keys(row)) {
    if (aliases.some((a) => norm(k) === norm(a))) return { key: k, value: (row[k] ?? "").trim() };
  }
  return { value: "" };
}

const looksPriority = (v: string) =>
  PRIORITY_VALUES.some((p) => norm(p) === norm(v)) ||
  /^[1-4]$/.test(v) || /high|medium|med|low|lowest|alta|media|baja/i.test(v);

const looksQuarter = (v: string) =>
  QUARTER_VALUES.some((q) => norm(q) === norm(v)) || /Q[1-4]/i.test(v);

const looksState = (v: string) => STATE_VALUES.some((s) => norm(s) === norm(v));

/**
 * Analiza el CSV y devuelve el informe de validación.
 * `existing` sirve para detectar IDs duplicados y padres inexistentes.
 */
export function validateImportCSV(text: string, type: ItemType, existing: RoadmapItem[] = []): ImportReport {
  const issues: ImportIssue[] = [];
  const rows = parseCSV(text);

  if (!rows.length) {
    return {
      headers: [], totalRows: 0, validRows: 0,
      issues: [{ severity: "error", message: "El fichero está vacío o no contiene filas de datos." }],
      errorCount: 1, warningCount: 0, ok: false,
    };
  }

  const headers = Object.keys(rows[0]);
  const expected = EXPECTED_COLUMNS[type];

  // --- Columnas obligatorias ------------------------------------------------
  for (const aliases of REQUIRED[type]) {
    if (!findHeader(headers, aliases)) {
      issues.push({
        severity: "error",
        column: aliases[0],
        message: `Falta la columna obligatoria "${aliases[0]}".`,
      });
    }
  }

  // --- Orden de columnas ----------------------------------------------------
  const present = expected.filter((e) => findHeader(headers, [e]));
  const inFileOrder = headers.filter((h) => expected.some((e) => norm(e) === norm(h)));
  const orderMismatch = present.some((e, i) => norm(inFileOrder[i] ?? "") !== norm(e));
  if (orderMismatch) {
    issues.push({
      severity: "warning",
      message: `El orden de columnas no coincide con la estructura esperada (${expected.join(", ")}). Se importará mapeando por nombre.`,
    });
  }

  const missingOptional = expected.filter((e) => !findHeader(headers, [e]));
  if (missingOptional.length) {
    issues.push({
      severity: "warning",
      message: `Columnas ausentes (se dejarán vacías): ${missingOptional.join(", ")}.`,
    });
  }

  const unknown = headers.filter((h) => h && !expected.some((e) => norm(e) === norm(h)));
  if (unknown.length) {
    issues.push({ severity: "warning", message: `Columnas no reconocidas (se ignorarán): ${unknown.join(", ")}.` });
  }

  // --- Validación fila a fila ----------------------------------------------
  const seen = new Map<string, number>();
  const existingIds = new Set(existing.map((i) => i.id));
  const fileIds = new Set<string>();
  const rowErrors = new Set<number>();

  const addIssue = (i: ImportIssue) => {
    issues.push(i);
    if (i.severity === "error" && i.row) rowErrors.add(i.row);
  };

  rows.forEach((r, idx) => {
    const n = idx + 1;
    const id = cell(r, ["id", "key", "work item id"]).value.replace(/\.0+$/, "");
    const title = cell(r, ["title", "name", "summary"]).value;

    if (!id) addIssue({ severity: "error", row: n, column: "ID", message: "ID vacío." });
    else {
      if (seen.has(id)) addIssue({ severity: "error", row: n, column: "ID", message: `ID duplicado dentro del fichero ("${id}", visto en la fila ${seen.get(id)}).` });
      else seen.set(id, n);
      fileIds.add(id);
      if (existingIds.has(id)) issues.push({ severity: "warning", row: n, column: "ID", message: `El ID "${id}" ya existe: se sobrescribirá.` });
    }

    if (!title) addIssue({ severity: "error", row: n, column: "Title", message: "Título vacío." });

    const effort = cell(r, ["effort", "effort (h)", "hours", "estimate", "story points", "original estimate"]);
    if (effort.value) {
      const num = Number(effort.value.replace(",", "."));
      if (!Number.isFinite(num)) addIssue({ severity: "error", row: n, column: effort.key ?? "Effort", message: `Esfuerzo no numérico: "${effort.value}".` });
      else if (num < 0) addIssue({ severity: "error", row: n, column: effort.key ?? "Effort", message: `Esfuerzo negativo: "${effort.value}".` });
    }

    const prio = cell(r, ["priority"]);
    if (prio.value && !looksPriority(prio.value)) {
      issues.push({ severity: "warning", row: n, column: prio.key ?? "Priority", message: `Prioridad no reconocida ("${prio.value}"): quedará sin prioridad.` });
    }

    const q = cell(r, ["quarter", "q", "iteration path", "iteration", "sprint"]);
    if (q.value && !looksQuarter(q.value)) {
      issues.push({ severity: "warning", row: n, column: q.key ?? "Quarter", message: `Quarter no reconocido ("${q.value}"): quedará sin asignar.` });
    }

    const st = cell(r, ["state", "status"]);
    if (st.value && !looksState(st.value)) {
      issues.push({ severity: "warning", row: n, column: st.key ?? "State", message: `Estado no válido ("${st.value}"): se usará "Backlog".` });
    }

    const pbis = cell(r, ["pbis #", "pbis"]);
    if (pbis.value && !Number.isFinite(Number(pbis.value))) {
      issues.push({ severity: "warning", row: n, column: pbis.key ?? "PBIs #", message: `"PBIs #" no numérico ("${pbis.value}"): es un valor calculado y se ignora.` });
    }
  });

  // --- Padres inexistentes --------------------------------------------------
  rows.forEach((r, idx) => {
    const parent = cell(r, ["parent", "parentid", "parent id", "parent work item", "epic id", "epic"]).value.replace(/\.0+$/, "");
    if (parent && !fileIds.has(parent) && !existingIds.has(parent)) {
      issues.push({ severity: "warning", row: idx + 1, column: "Parent", message: `El padre "${parent}" no existe ni en el fichero ni en el roadmap.` });
    }
  });

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;

  return {
    headers,
    totalRows: rows.length,
    validRows: rows.length - rowErrors.size,
    issues,
    errorCount,
    warningCount,
    ok: errorCount === 0,
  };
}
