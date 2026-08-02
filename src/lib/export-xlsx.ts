/**
 * =============================================================================
 * Exportación a Excel (.xlsx)
 * =============================================================================
 * Genera el libro que replica el formato de seguimiento usado por negocio:
 * una hoja con los work items y otra con el resumen de capacidad/utilización
 * por Quarter. Se ejecuta íntegramente en el navegador (sin backend) usando
 * la librería `xlsx`.
 *
 * Los cálculos NO se duplican aquí: se reutilizan los del dominio
 * (`rolledUpEffort`, `effortByQuarter`, `capacityPerQuarter`) para que el Excel
 * y la aplicación muestren siempre las mismas cifras.
 */
import * as XLSX from "xlsx";
import type { RoadmapItem, CapacityConfig, RealQuarter } from "./roadmap";
import { capacityPerSprint, capacityPerQuarter, effortByQuarter, rolledUpEffort } from "./roadmap";

/** Quarters reales exportables ("MULTI" y "" no son columnas del informe). */
const QUARTERS: RealQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

const PRIO_LABEL: Record<string, string> = {
  "1-High": 1,
  "2-Medium": 2,
  "3-Low": 3,
  "4-Lowest": 4,
} as any;
const prioNum = (p?: string) => (p && PRIO_LABEL[p]) || "";

function sheetConfig(cfg: CapacityConfig) {
  const capSprint = capacityPerSprint(cfg);
  const capQ = capacityPerQuarter(cfg);
  const rows: any[][] = [
    ["⚙️ Configuración Global"],
    [],
    ["PARÁMETROS DE CAPACIDAD"],
    ["Parámetro", "Valor", "Unidad", "Descripción"],
    ["Developers en equipo", cfg.developers, "personas", "Número total de developers"],
    ["% Dedicación al roadmap", cfg.dedicationPct / 100, "%", `Porcentaje de tiempo dedicado (${cfg.dedicationPct}%)`],
    ["Días por sprint", cfg.daysPerSprint, "días", "Días laborables por sprint"],
    ["Horas por día", cfg.hoursPerDay, "horas", "Horas productivas por día"],
    ["Sprints por quarter", cfg.sprintsPerQuarter, "sprints", "Número de sprints en cada quarter"],
    [],
    ["CAPACIDAD CALCULADA"],
    ["Capacidad por sprint", capSprint, "horas", "Developers × % Dedicación × Días × Horas"],
    ["Capacidad por quarter", capQ, "horas", "Capacidad sprint × Sprints por quarter"],
    ["Capacidad anual", capQ * 4, "horas", "Capacidad quarter × 4 quarters"],
    [],
    ["LISTAS DE VALORES"],
    ["Quarters", "Q1, Q2, Q3, Q4"],
    ["Priorities", "1-High, 2-Medium, 3-Low, 4-Lowest"],
    ["States", "Backlog, In Progress, Done, Blocked"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 12 }, { wch: 60 }];
  return ws;
}

function sheetDashboard(items: RoadmapItem[], cfg: CapacityConfig) {
  const epics = items.filter((i) => i.type === "epic").length;
  const feats = items.filter((i) => i.type === "feature").length;
  const stories = items.filter((i) => i.type === "story").length;
  const eff = effortByQuarter(items);
  const totalEffort = QUARTERS.reduce((s, q) => s + (eff[q] || 0), 0);
  const capYear = capacityPerQuarter(cfg) * 4;

  const rows: any[][] = [
    ["📊 Product Roadmap — Dashboard Ejecutivo"],
    [],
    ["📈 KPIs Principales"],
    ["Métrica", "Valor", "Unidad"],
    ["Total EPICs", epics, "items"],
    ["Total Features", feats, "items"],
    ["Total User Stories", stories, "items"],
    ["Esfuerzo Total", totalEffort, "horas"],
    ["Capacidad Total", capYear, "horas"],
    ["% Utilización Global", capYear ? totalEffort / capYear : 0, "%"],
    [],
    ["📅 Resumen por Quarter"],
    ["Quarter", "Esfuerzo (h)", "Capacidad (h)", "% Utilización", "Items", "Estado"],
  ];
  let totItems = 0;
  QUARTERS.forEach((q) => {
    const e = eff[q] || 0;
    const c = capacityPerQuarter(cfg, q);
    const itemsQ = items.filter((i) => i.quarter === q && !i.hiddenFromRoadmap).length;
    totItems += itemsQ;
    const util = c ? e / c : 0;
    const estado = util === 0 ? "Vacío" : util > 1 ? "🚫 Sobrecarga" : util < 0.5 ? "⚠ Sub-utilizado" : "✅ OK";
    rows.push([q, e, c, util, itemsQ, estado]);
  });
  rows.push(["TOTAL", totalEffort, capYear, capYear ? totalEffort / capYear : 0, totItems, ""]);
  rows.push([]);
  rows.push(["🎯 Distribución por Prioridad"]);
  rows.push(["Prioridad", "Items", "Esfuerzo (h)"]);
  const prios = ["1-High", "2-Medium", "3-Low", "4-Lowest", ""] as const;
  const labels: Record<string, string> = {
    "1-High": "1 - High",
    "2-Medium": "2 - Medium",
    "3-Low": "3 - Low",
    "4-Lowest": "4 - Lowest",
    "": "Sin prioridad",
  };
  prios.forEach((p) => {
    const list = items.filter((i) => (i.priority || "") === p);
    const e = list.reduce((s, i) => {
      const hasKids = items.some((c) => c.parentId === i.id);
      return s + (hasKids ? 0 : i.effort || 0);
    }, 0);
    rows.push([labels[p], list.length, e]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 18 }];
  return ws;
}

function sheetItems(items: RoadmapItem[], type: "epic" | "feature" | "story", title: string) {
  const list = items.filter((i) => i.type === type);
  const witLabel: Record<string, string> = { epic: "Epic", feature: "Feature", story: "User Story" };
  const header =
    type === "epic"
      ? ["ID", "Title", "Description", "Effort (h)", "Priority", "Quarter", "State", "Tags", "Notes"]
      : type === "story"
        ? ["ID", "Title", "Parent Type", "Parent ID", "Parent Title", "Effort (h)", "Priority", "Quarter", "Comments"]
        : ["ID", "Title", "Parent", "Effort (h)", "Priority", "Quarter", "State", "Tags", "Notes"];
  const rows: any[][] = [[title], header];
  list.forEach((it) => {
    const effort = items.some((c) => c.parentId === it.id) ? rolledUpEffort(it, items) : it.effort ?? "";
    if (type === "epic") {
      rows.push([
        it.id, it.title, it.description || "", effort, prioNum(it.priority),
        it.quarter || "", it.state || "", it.tags || "", it.notes || "",
      ]);
    } else if (type === "story") {
      const parent = items.find((p) => p.id === it.parentId);
      rows.push([
        it.id, it.title, parent ? witLabel[parent.type] : "", it.parentId || "", parent?.title || "",
        effort, prioNum(it.priority), it.quarter || "", it.notes || "",
      ]);
    } else {
      rows.push([
        it.id, it.title, it.parentId || "", effort, prioNum(it.priority),
        it.quarter || "", it.state || "", it.tags || "", it.notes || "",
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, { wch: 60 }, { wch: 40 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 40 },
  ];
  return ws;
}

function sheetRoadmap(items: RoadmapItem[]) {
  const rows: any[][] = [["Quarter", "ID", "Type", "Title", "Effort (h)", "Priority", "Parent"]];
  QUARTERS.forEach((q) => {
    const list = items.filter((i) => i.quarter === q && !i.hiddenFromRoadmap);
    list.forEach((it) => {
      const effort = items.some((c) => c.parentId === it.id) ? rolledUpEffort(it, items) : it.effort ?? "";
      rows.push([q, it.id, it.type, it.title, effort, prioNum(it.priority), it.parentId || ""]);
    });
    rows.push([]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 60 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  return ws;
}

export function exportRoadmapXlsx(items: RoadmapItem[], cfg: CapacityConfig, filename = "RoadGate-Roadmap.xlsx") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetConfig(cfg), "Configuración");
  XLSX.utils.book_append_sheet(wb, sheetDashboard(items, cfg), "Dashboard Ejecutivo");
  XLSX.utils.book_append_sheet(wb, sheetRoadmap(items), "Roadmap");
  XLSX.utils.book_append_sheet(wb, sheetItems(items, "epic", "🎯 EPICS - Iniciativas Estratégicas"), "EPICS");
  XLSX.utils.book_append_sheet(wb, sheetItems(items, "feature", "🔧 FEATURES - Funcionalidades"), "Features");
  XLSX.utils.book_append_sheet(wb, sheetItems(items, "story", "📝 USER STORIES"), "US");
  XLSX.writeFile(wb, filename);
}

const TYPE_SHEET: Record<string, { sheet: string; title: string; file: string }> = {
  epic: { sheet: "EPICS", title: "🎯 EPICS - Iniciativas Estratégicas", file: "RoadGate-Epics.xlsx" },
  feature: { sheet: "Features", title: "🔧 FEATURES - Funcionalidades", file: "RoadGate-Features.xlsx" },
  story: { sheet: "US", title: "📝 USER STORIES", file: "RoadGate-UserStories.xlsx" },
};

/** Exporta a Excel sólo los work items de un tipo concreto (Epic, Feature o User Story). */
export function exportItemsXlsx(items: RoadmapItem[], type: "epic" | "feature" | "story", filename?: string) {
  const meta = TYPE_SHEET[type];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetItems(items, type, meta.title), meta.sheet);
  XLSX.writeFile(wb, filename ?? meta.file);
}
