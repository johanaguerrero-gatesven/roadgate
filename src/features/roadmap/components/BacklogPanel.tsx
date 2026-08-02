/**
 * BacklogPanel — vista tipo hoja de cálculo del backlog.
 * Una fila por work item con edición en línea (ID, título, padre, esfuerzo,
 * prioridad, quarter y observaciones). El esfuerzo de los items con hijos está
 * bloqueado: se muestra la suma (Σ) que calcula el dominio.
 * También ofrece importación CSV y exportación a Excel por tipo de item.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, Download, Plus, Trash2, FileSpreadsheet, Eye, EyeOff, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { RoadmapItem, ItemType, Quarter, Priority, toCSV, rolledUpEffort } from "@/lib/roadmap";
import { validateImportCSV, type ImportReport } from "@/lib/csv-validation";
import { PRIORITIES, PRIORITY_META, QUARTERS, type RealPriority } from "../constants";
import { PriorityIcon } from "./PriorityIcon";
import { ParentPicker } from "./ParentPicker";
import { IdInput } from "./IdInput";
import { ImportReportDialog } from "./ImportReportDialog";

/** Tabla estilo Excel con todos los work items de un tipo. */
export function BacklogPanel({
  type, items, wrapText, onAdd, onUpdate, onMoveQuarter, onRemove, onImport, onExportXlsx, onResetType,
}: {
  type: ItemType;
  items: RoadmapItem[];
  wrapText: boolean;
  onAdd: () => void;
  onUpdate: (uid: string, patch: Partial<RoadmapItem>) => void;
  onMoveQuarter: (uid: string, quarter: Quarter) => void;
  onRemove: (uid: string) => void;
  onImport: (csv: string) => void;
  onExportXlsx: () => void;
  onResetType: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ csv: string; name: string; report: ImportReport } | null>(null);
  const rowsFor = (v: string, cpl: number) =>
    wrapText
      ? Math.max(1, v.split("\n").reduce((s, l) => s + Math.ceil((l.length || 1) / cpl), 0))
      : 1;

  const list = items.filter((i) => i.type === type);
  const isFeature = type === "feature";

  const parents = items.filter((i) =>
    type === "feature" ? i.type === "epic"
    : type === "story" ? (i.type === "epic" || i.type === "feature")
    : false
  );

  /**
   * Acepta CSV y Excel (.xlsx/.xls). Los Excel se convierten a CSV en el
   * navegador (SheetJS) para reutilizar el mismo parser de importación.
   * Antes de importar se valida la estructura y se muestra el informe.
   */
  const review = (csv: string, name: string) => {
    const report = validateImportCSV(csv, type, items);
    setPending({ csv, name, report });
    if (!report.ok) toast.error(`Importación bloqueada: ${report.errorCount} errores en el fichero`);
    else if (report.warningCount) toast.warning(`${report.warningCount} avisos en el fichero`);
  };

  const handleFile = async (f: File) => {
    const isExcel = /\.(xlsx|xlsm|xls)$/i.test(f.name);
    if (isExcel) {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        review(XLSX.utils.sheet_to_csv(sheet), f.name);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo leer el Excel");
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => review(String(reader.result || ""), f.name);
    reader.readAsText(f);
  };
  const exportCsv = () => {
    const blob = new Blob([toCSV(list, type, items)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${type}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={onAdd}><Plus className="h-4 w-4" /> {t("roadmap.add")}</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {t("roadmap.import")}
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> {t("roadmap.export")}
        </Button>
        <Button variant="outline" onClick={onExportXlsx}>
          <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
        </Button>
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onResetType}>
          <Trash2 className="h-4 w-4" /> Reset demo data
        </Button>
        <input
          ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls,.xlsm" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
        />

        <span className="text-xs text-muted-foreground ml-auto">
          {list.length} {type === "story" ? "user stories" : `${type}s`}
        </span>
      </div>

      <ImportReportDialog
        report={pending?.report ?? null}
        type={type}
        fileName={pending?.name}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          onImport(pending.csv);
          toast.success(`${pending.report.validRows} filas importadas`);
          setPending(null);
        }}
      />



      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
          <h3 className="mt-3 font-semibold text-foreground">{t("roadmap.empty.title")} {type === "story" ? "user stories" : type + "s"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("roadmap.empty.lead")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain rounded-xl [scrollbar-width:thin]">
            <table className="w-max min-w-full text-[13px] border-separate border-spacing-0">
              <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-border">
                  <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-sm border-r border-border w-[130px] min-w-[105px]">ID</th>
                  <th className="min-w-[200px]">{t("roadmap.col.title")}</th>
                  {!isFeature && <th className="min-w-[80px]">Description</th>}
                  {type !== "epic" && <th className="min-w-[80px]">{isFeature ? "EPIC ID" : t("roadmap.col.parent")}</th>}
                  {isFeature && <th className="min-w-[80px]">EPIC Title</th>}
                  <th className="min-w-[80px] text-right">{isFeature ? "Effort (h)" : "Effort"}</th>
                  <th className="min-w-[80px]">Priority</th>
                  <th className="min-w-[80px]">Quarter</th>
                  <th className="min-w-[105px]">State</th>
                  {isFeature ? <th className="min-w-[110px]">Owner</th> : <th className="min-w-[105px]">Tags</th>}
                  {isFeature && <th className="min-w-[80px] text-right">PBIs #</th>}
                  <th className="min-w-[80px]">{isFeature ? "Comments" : "Notes"}</th>
                  <th className="min-w-[70px] text-center">Show</th>
                  <th className="min-w-[56px]"></th>
                </tr>
              </thead>

              <tbody>
                {list.map((it) => {
                  const hidden = !!it.hiddenFromRoadmap;
                  const kids = items.filter((c) => c.parentId === it.id);
                  const hasKids = type !== "story" && kids.length > 0;
                  const epicTitle = items.find((p) => p.id === it.parentId)?.title || "";

                  return (
                    <tr
                      key={it.uid}
                      className={`group transition-colors [&>td]:px-2 [&>td]:py-1 [&>td]:align-top [&>td]:border-b [&>td]:border-border/70 hover:[&>td]:bg-muted/40 ${hidden ? "opacity-60" : ""}`}
                    >
                      <td className="sticky left-0 z-10 bg-card border-r border-border group-hover:bg-muted/40">
                        <IdInput value={it.id} onCommit={(v) => onUpdate(it.uid, { id: v })} />
                      </td>

                      <td>
                        <Textarea
                          value={it.title}
                          onChange={(e) => onUpdate(it.uid, { title: e.target.value })}
                          rows={rowsFor(it.title || "", 42)}
                          className={`min-h-[30px] rounded-md text-sm leading-snug py-1 px-1.5 font-medium ${wrapText ? "resize-none overflow-hidden break-words" : "resize-y"}`}
                          placeholder={t("roadmap.col.title")}
                        />
                        {hasKids && (
                          <div className="text-[10px] text-muted-foreground italic mt-1">
                            Σ {rolledUpEffort(it, items)}h ({t("roadmap.rollupTitle")})
                          </div>
                        )}
                      </td>
                      {!isFeature && (
                        <td>
                          <Textarea
                            value={it.description || ""}
                            onChange={(e) => onUpdate(it.uid, { description: e.target.value })}
                            rows={rowsFor(it.description || "", 32)}
                            className={`min-h-[30px] rounded-md text-xs leading-snug py-1 px-1.5 ${wrapText ? "resize-none overflow-hidden break-words" : "resize-y"}`}
                            placeholder="—"
                          />
                        </td>
                      )}
                      {type !== "epic" && (
                        <td>
                          <ParentPicker
                            value={it.parentId}
                            parents={parents}
                            onChange={(v) => onUpdate(it.uid, { parentId: v || undefined })}
                          />
                        </td>
                      )}
                      {isFeature && (
                        <td className="text-xs text-muted-foreground pt-2 leading-snug break-words">
                          {epicTitle || "—"}
                        </td>
                      )}

                      <td>
                        {hasKids ? (
                          <div
                            className="h-8 flex items-center justify-end px-2.5 text-xs text-muted-foreground bg-muted/30 rounded-md border border-dashed border-border cursor-not-allowed"
                            title={t("roadmap.rollupTitle")}
                          >
                            Σ {rolledUpEffort(it, items)}h
                          </div>
                        ) : (
                          <Input
                            type="number" min={0}
                            value={it.effort ?? ""}
                            onChange={(e) => onUpdate(it.uid, {
                              effort: e.target.value === "" ? undefined : Number(e.target.value),
                            })}
                            placeholder="0"
                            className="h-8 text-xs text-right"
                          />
                        )}
                      </td>

                      <td>
                        <Select
                          value={it.priority || "__none"}
                          onValueChange={(v) => onUpdate(it.uid, { priority: (v === "__none" ? "" : v) as Priority })}
                        >
                          <SelectTrigger className="h-8 text-xs gap-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                            <SelectValue>
                              {it.priority ? (
                                <span className="flex items-center gap-1.5">
                                  <PriorityIcon p={it.priority} />
                                  {PRIORITY_META[it.priority as RealPriority].label}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <Minus className="h-4 w-4" />
                                  {t("roadmap.priority.none")}
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none" className="text-xs">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Minus className="h-4 w-4" /> {t("roadmap.priority.none")}
                              </span>
                            </SelectItem>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p} className="text-xs">
                                <span className="flex items-center gap-2">
                                  <PriorityIcon p={p} /> {PRIORITY_META[p].label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td>
                        <Select
                          value={it.quarter || "__bl"}
                          onValueChange={(v) => onMoveQuarter(it.uid, (v === "__bl" ? "" : v) as Quarter)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__bl" className="text-xs">Backlog</SelectItem>
                            {QUARTERS.map((q) => (
                              <SelectItem key={q} value={q} className="text-xs">{q}</SelectItem>
                            ))}
                            {it.quarter === "MULTI" && (
                              <SelectItem value="MULTI" className="text-xs" disabled>Multi-Quarter</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        <Input
                          value={it.state || ""}
                          onChange={(e) => onUpdate(it.uid, { state: e.target.value as RoadmapItem["state"] })}
                          className="h-8 text-xs"
                          placeholder="—"
                        />
                      </td>
                      <td>
                        <Input
                          value={it.tags || ""}
                          onChange={(e) => onUpdate(it.uid, { tags: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="—"
                        />
                      </td>
                      {isFeature && (
                        <td className="text-xs text-muted-foreground text-right pt-2">{kids.length}</td>
                      )}

                      <td>
                        <Textarea
                          value={it.notes || ""}
                          onChange={(e) => onUpdate(it.uid, { notes: e.target.value })}
                          rows={rowsFor(it.notes || "", 32)}
                          className={`min-h-[30px] rounded-md text-xs leading-snug py-1 px-1.5 ${wrapText ? "resize-none overflow-hidden break-words" : "resize-y"}`}
                          placeholder="—"
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          title={hidden ? "Show in roadmap" : "Hide from roadmap"}
                          onClick={() => onUpdate(it.uid, { hiddenFromRoadmap: !hidden })}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-primary" />}
                        </button>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => onRemove(it.uid)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
