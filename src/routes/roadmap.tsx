import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter, Priority, State, DisplayMode,
  loadItems, saveItems, importCSV, toCSV, uid,
  loadCapacity, saveCapacity, capacityPerQuarter, capacityPerSprint,
  CapacityConfig, buildRoadmapView, effortByQuarter, sprintsForQuarter,
  rolledUpEffort, effortByPriority, countByPriority,
} from "@/lib/roadmap";
import { ArrowLeft, Upload, Download, Plus, Trash2, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/roadmap")({
  head: () => ({ meta: [{ title: "Roadmap — RoadGate" }] }),
  component: RoadmapPage,
});

type RealQuarter = Exclude<Quarter, "">;
const QUARTERS: RealQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
const PRIORITIES: Priority[] = ["1-High", "2-Medium", "3-Low"];
const STATES: State[] = ["Backlog", "In Progress", "Done", "Blocked"];

function RoadmapPage() {
  const { session, ready } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [cfg, setCfg] = useState<CapacityConfig>(loadCapacity());
  const [tab, setTab] = useState<ItemType>("epic");

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  useEffect(() => { setItems(loadItems()); }, []);
  useEffect(() => {
    const h = () => { setItems(loadItems()); setCfg(loadCapacity()); };
    window.addEventListener("roadgate:roadmap", h);
    return () => window.removeEventListener("roadgate:roadmap", h);
  }, []);

  const update = (next: RoadmapItem[]) => { setItems(next); saveItems(next); };
  const updateOne = (uidKey: string, patch: Partial<RoadmapItem>) => {
    update(items.map((it) => (it.uid === uidKey ? { ...it, ...patch } : it)));
  };
  const remove = (uidKey: string) => update(items.filter((it) => it.uid !== uidKey));
  const add = (type: ItemType) => {
    const prefix = type === "epic" ? "EPIC" : type === "feature" ? "FEAT" : "US";
    const n = items.filter((i) => i.type === type).length + 1;
    update([...items, {
      uid: uid(), id: `${prefix}-${String(n).padStart(2, "0")}`, type,
      title: `${t("roadmap.new")} ${type}`, state: "Backlog",
    }]);
  };

  if (!ready || !session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app"><ArrowLeft className="h-4 w-4" /> App</Link>
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("roadmap.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("roadmap.lead")}
            </p>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">{t("roadmap.tab.dashboard")}</TabsTrigger>
            <TabsTrigger value="backlog">{t("roadmap.tab.backlog")}</TabsTrigger>
            <TabsTrigger value="roadmap">{t("roadmap.tab.roadmap")}</TabsTrigger>
            <TabsTrigger value="capacity">{t("roadmap.tab.capacity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardPanel items={items} cfg={cfg} />
          </TabsContent>

          <TabsContent value="backlog" className="mt-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as ItemType)}>
              <TabsList>
                <TabsTrigger value="epic">Epics ({items.filter((i) => i.type === "epic").length})</TabsTrigger>
                <TabsTrigger value="feature">Features ({items.filter((i) => i.type === "feature").length})</TabsTrigger>
                <TabsTrigger value="story">User Stories ({items.filter((i) => i.type === "story").length})</TabsTrigger>
              </TabsList>
              {(["epic", "feature", "story"] as ItemType[]).map((t) => (
                <TabsContent key={t} value={t} className="mt-4">
                  <BacklogPanel
                    type={t}
                    items={items}
                    onAdd={() => add(t)}
                    onUpdate={updateOne}
                    onRemove={remove}
                    onImport={(csv) => update(importCSV(csv, t, items))}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="roadmap" className="mt-6">
            <RoadmapView items={items} cfg={cfg} />
          </TabsContent>

          <TabsContent value="capacity" className="mt-6">
            <CapacityPanel cfg={cfg} onChange={(c) => { setCfg(c); saveCapacity(c); }} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function BacklogPanel({
  type, items, onAdd, onUpdate, onRemove, onImport,
}: {
  type: ItemType;
  items: RoadmapItem[];
  onAdd: () => void;
  onUpdate: (uid: string, patch: Partial<RoadmapItem>) => void;
  onRemove: (uid: string) => void;
  onImport: (csv: string) => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const list = items.filter((i) => i.type === type);
  const parents = items.filter((i) => i.type === (type === "story" ? "feature" : type === "feature" ? "epic" : ""));

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => onImport(String(reader.result || ""));
    reader.readAsText(f);
  };

  const exportCsv = () => {
    const blob = new Blob([toCSV(list)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${type}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={onAdd}><Plus className="h-4 w-4" /> Añadir</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
        />
        <span className="text-xs text-muted-foreground ml-auto">
          Acepta CSV de Azure DevOps (<code>ID, Work Item Type, Title, Parent, State, Effort, Priority, Iteration Path, Tags</code>) o un CSV simple con <code>id, title, parent, effort, priority, quarter</code>.
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
          <h3 className="mt-3 font-semibold text-foreground">Aún no hay {type === "story" ? "user stories" : type + "s"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Importa un CSV o añade entradas manualmente.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ID</TableHead>
                <TableHead className="min-w-[220px]">Título</TableHead>
                {type !== "epic" && <TableHead className="w-40">Parent</TableHead>}
                <TableHead className="w-24">Esfuerzo (h)</TableHead>
                <TableHead className="w-32">Prioridad</TableHead>
                <TableHead className="w-24">Quarter</TableHead>
                <TableHead className="w-20">Sprint</TableHead>
                {type !== "story" && <TableHead className="w-32">En roadmap</TableHead>}
                <TableHead className="w-32">Estado</TableHead>
                <TableHead className="min-w-[180px]">Notas</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((it) => (
                <TableRow key={it.uid}>
                  <TableCell>
                    <Input value={it.id} onChange={(e) => onUpdate(it.uid, { id: e.target.value })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={it.title} onChange={(e) => onUpdate(it.uid, { title: e.target.value })} className="h-8" />
                  </TableCell>
                  {type !== "epic" && (
                    <TableCell>
                      <Select value={it.parentId || ""} onValueChange={(v) => onUpdate(it.uid, { parentId: v || undefined })}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {parents.map((p) => (
                            <SelectItem key={p.uid} value={p.id}>{p.id} · {p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={0}
                        value={it.effort ?? ""} onChange={(e) => onUpdate(it.uid, { effort: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="h-8"
                      />
                      {type !== "story" && items.some((c) => c.parentId === it.id) && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap" title="Suma esfuerzo de los hijos">
                          Σ {rolledUpEffort(it, items)}h
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={it.priority || ""} onValueChange={(v) => onUpdate(it.uid, { priority: v as Priority })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={it.quarter || ""} onValueChange={(v) => onUpdate(it.uid, { quarter: v as Quarter })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min={1}
                      placeholder="—"
                      value={it.sprint ?? ""}
                      onChange={(e) => onUpdate(it.uid, { sprint: e.target.value === "" ? undefined : Number(e.target.value) })}
                      className="h-8 w-16"
                    />
                  </TableCell>
                  {type !== "story" && (
                    <TableCell>
                      <Select
                        value={it.displayMode || "auto"}
                        onValueChange={(v) => onUpdate(it.uid, { displayMode: v as DisplayMode })}
                      >
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="self">Mostrar padre</SelectItem>
                          <SelectItem value="children">Mostrar hijos</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  <TableCell>
                    <Select value={it.state || "Backlog"} onValueChange={(v) => onUpdate(it.uid, { state: v as State })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={it.notes ?? ""} onChange={(e) => onUpdate(it.uid, { notes: e.target.value })}
                      className="min-h-[36px] text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onRemove(it.uid)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CapacityPanel({ cfg, onChange }: { cfg: CapacityConfig; onChange: (c: CapacityConfig) => void }) {
  type NumKey = "developers" | "dedicationPct" | "daysPerSprint" | "hoursPerDay" | "sprintsPerQuarter";
  const fields: { key: NumKey; label: string }[] = [
    { key: "developers", label: "Developers" },
    { key: "dedicationPct", label: "% Dedicación" },
    { key: "daysPerSprint", label: "Días por sprint" },
    { key: "hoursPerDay", label: "Horas por día" },
    { key: "sprintsPerQuarter", label: "Sprints por quarter (default)" },
  ];
  const sprint = capacityPerSprint(cfg);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="font-semibold text-foreground mb-2">Parámetros globales</h3>
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3">
            <label className="text-sm text-muted-foreground">{f.label}</label>
            <Input
              type="number" min={0}
              value={cfg[f.key]}
              onChange={(e) => onChange({ ...cfg, [f.key]: Number(e.target.value) })}
              className="w-32 h-9"
            />
          </div>
        ))}
        <div className="pt-3 mt-2 border-t border-border space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Sprints por quarter</h4>
          <p className="text-xs text-muted-foreground">Sobrescribe el valor por defecto si un quarter tiene menos sprints (vacaciones, releases, etc.).</p>
          {QUARTERS.map((q) => (
            <div key={q} className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground">{q}</label>
              <Input
                type="number" min={0}
                value={cfg.sprintsByQuarter?.[q] ?? cfg.sprintsPerQuarter}
                onChange={(e) => onChange({
                  ...cfg,
                  sprintsByQuarter: { ...(cfg.sprintsByQuarter || {}), [q]: Number(e.target.value) },
                })}
                className="w-24 h-9"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Capacidad calculada</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Por sprint</dt><dd className="font-semibold">{sprint.toFixed(0)} h</dd></div>
          {QUARTERS.map((q) => (
            <div key={q} className="flex justify-between">
              <dt>{q} ({sprintsForQuarter(cfg, q)} sprints)</dt>
              <dd className="font-semibold">{capacityPerQuarter(cfg, q).toFixed(0)} h</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2">
            <dt>Anual</dt>
            <dd className="font-semibold">
              {QUARTERS.reduce((s, q) => s + capacityPerQuarter(cfg, q), 0).toFixed(0)} h
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function RoadmapView({ items, cfg }: { items: RoadmapItem[]; cfg: CapacityConfig }) {
  const view = useMemo(() => buildRoadmapView(items), [items]);
  const effortMap = useMemo(() => effortByQuarter(items), [items]);
  const capSprint = capacityPerSprint(cfg);

  const byQuarter = useMemo(() => {
    const map: Record<Quarter, { item: RoadmapItem; quarter: Quarter; rolledUp: boolean }[]> =
      { Q1: [], Q2: [], Q3: [], Q4: [], "": [] };
    view.forEach((v) => map[v.quarter].push(v));
    return map;
  }, [view]);

  const priorityColor = (p?: Priority) =>
    p === "1-High" ? "bg-destructive/15 text-destructive border-destructive/30"
    : p === "2-Medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : p === "3-Low" ? "bg-muted text-muted-foreground border-border"
    : "bg-muted text-muted-foreground border-border";

  const typeColor = (t: ItemType) =>
    t === "epic" ? "bg-primary/15 text-primary border-primary/30"
    : t === "feature" ? "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";

  const barColor = (pct: number) =>
    pct === 0 ? "bg-muted"
    : pct > 110 ? "bg-destructive"
    : pct < 90 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-6">
      {/* KPI por quarter */}
      <div className="grid md:grid-cols-4 gap-4">
        {QUARTERS.map((q) => {
          const eff = effortMap[q];
          const cap = capacityPerQuarter(cfg, q);
          const pct = cap > 0 ? (eff / cap) * 100 : 0;
          const status =
            pct === 0 ? { label: "Vacío", cls: "text-muted-foreground" }
            : pct > 110 ? { label: "🚫 Sobrecarga", cls: "text-destructive" }
            : pct < 90 ? { label: "⚠️ Subutilizado", cls: "text-amber-600 dark:text-amber-400" }
            : { label: "✅ OK", cls: "text-emerald-600 dark:text-emerald-400" };
          return (
            <div key={q} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{q} · {sprintsForQuarter(cfg, q)} sprints</span>
                <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
              </div>
              <div className="mt-2 text-2xl font-bold">
                {eff} <span className="text-sm font-normal text-muted-foreground">/ {cap.toFixed(0)} h</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 150)}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {pct.toFixed(0)}% utilización · {byQuarter[q].length} items
              </div>
            </div>
          );
        })}
      </div>

      {/* Vista por quarter, desglosada por sprint */}
      <div className="space-y-6">
        {QUARTERS.map((q) => {
          const sprints = sprintsForQuarter(cfg, q);
          const cellsPerSprint: { item: RoadmapItem; rolledUp: boolean }[][] = [];
          const unassigned: { item: RoadmapItem; rolledUp: boolean }[] = [];
          for (let i = 0; i < sprints; i++) cellsPerSprint.push([]);
          byQuarter[q].forEach((v) => {
            const s = v.item.sprint;
            if (typeof s === "number" && s >= 1 && s <= sprints) {
              cellsPerSprint[s - 1].push(v);
            } else {
              unassigned.push(v);
            }
          });

          return (
            <div key={q} className="rounded-xl border border-border bg-card overflow-x-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">{q}</h3>
                <span className="text-xs text-muted-foreground">
                  {sprints} sprints · {capSprint.toFixed(0)} h/sprint · {capacityPerQuarter(cfg, q).toFixed(0)} h total
                </span>
              </div>
              {sprints === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Sin sprints configurados para este quarter.</div>
              ) : (
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${sprints}, minmax(220px, 1fr))`, minWidth: `${sprints * 220}px` }}
                >
                  {cellsPerSprint.map((cell, i) => {
                    const eff = cell.reduce((s, v) => s + (v.item.effort || 0), 0);
                    const pct = capSprint > 0 ? (eff / capSprint) * 100 : 0;
                    return (
                      <div key={i} className="border-l border-border first:border-l-0 p-3 space-y-2 align-top">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">Sprint {i + 1}</span>
                          <span className="text-[10px] text-muted-foreground">{eff} / {capSprint.toFixed(0)} h</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 150)}%` }} />
                        </div>
                        {cell.length === 0 && <div className="text-xs text-muted-foreground/60 pt-2">—</div>}
                        {cell.map((v) => {
                          const it = v.item;
                          return (
                            <div key={it.uid} className={`rounded-md border p-2 text-xs ${typeColor(it.type)}`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold">{it.id}</span>
                                {it.priority && (
                                  <span className={`px-1.5 py-0.5 rounded border text-[10px] ${priorityColor(it.priority)}`}>
                                    {it.priority.split("-")[0]}
                                  </span>
                                )}
                              </div>
                              <div className="text-foreground mt-0.5 line-clamp-2">{it.title}</div>
                              <div className="flex items-center justify-between mt-1">
                                {(it.effort ?? 0) > 0
                                  ? <span className="text-[10px] text-muted-foreground">{it.effort}h</span>
                                  : <span />}
                                {v.rolledUp && (
                                  <span className="text-[10px] text-muted-foreground italic">rollup</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
              {unassigned.length > 0 && (
                <div className="border-t border-border p-3 bg-muted/20">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Sin sprint asignado en {q} ({unassigned.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {unassigned.map((v) => (
                      <Badge key={v.item.uid} variant="outline" className={typeColor(v.item.type)}>
                        {v.item.id} · {v.item.title}
                        {(v.item.effort ?? 0) > 0 ? ` · ${v.item.effort}h` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {byQuarter[""].length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-4">
          <h4 className="font-semibold text-foreground mb-2">Sin quarter asignado ({byQuarter[""].length})</h4>
          <div className="flex flex-wrap gap-2">
            {byQuarter[""].map((v) => (
              <Badge key={v.item.uid} variant="outline" className={typeColor(v.item.type)}>
                {v.item.id} · {v.item.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



function DashboardPanel({ items, cfg }: { items: RoadmapItem[]; cfg: CapacityConfig }) {
  const effortMap = useMemo(() => effortByQuarter(items), [items]);
  const prioCount = useMemo(() => countByPriority(items), [items]);
  const prioEffort = useMemo(() => effortByPriority(items), [items]);

  const totalEffort = QUARTERS.reduce((s, q) => s + effortMap[q], 0);
  const totalCap = QUARTERS.reduce((s, q) => s + capacityPerQuarter(cfg, q), 0);
  const globalPct = totalCap > 0 ? (totalEffort / totalCap) * 100 : 0;

  const counts = {
    epic: items.filter((i) => i.type === "epic").length,
    feature: items.filter((i) => i.type === "feature").length,
    story: items.filter((i) => i.type === "story").length,
  };

  const barColor = (pct: number) =>
    pct === 0 ? "bg-muted"
    : pct > 110 ? "bg-destructive"
    : pct < 90 ? "bg-amber-500" : "bg-emerald-500";

  const globalStatus =
    globalPct === 0 ? { label: "Vacío", cls: "text-muted-foreground" }
    : globalPct > 110 ? { label: "🚫 Sobrecarga anual", cls: "text-destructive" }
    : globalPct < 90 ? { label: "⚠️ Subutilización anual", cls: "text-amber-600 dark:text-amber-400" }
    : { label: "✅ Equilibrado", cls: "text-emerald-600 dark:text-emerald-400" };

  const prioColor = (p: string) =>
    p === "1-High" ? "bg-destructive"
    : p === "2-Medium" ? "bg-amber-500"
    : p === "3-Low" ? "bg-emerald-500"
    : "bg-muted-foreground/40";

  const maxPrioEffort = Math.max(1, ...Object.values(prioEffort));

  return (
    <div className="space-y-6">
      {/* KPIs cabecera */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Items totales</div>
          <div className="mt-1 text-2xl font-bold">{items.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {counts.epic} epics · {counts.feature} features · {counts.story} stories
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Esfuerzo planificado</div>
          <div className="mt-1 text-2xl font-bold">{totalEffort.toFixed(0)} h</div>
          <div className="mt-1 text-xs text-muted-foreground">de {totalCap.toFixed(0)} h disponibles</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Utilización anual</div>
          <div className="mt-1 text-2xl font-bold">{globalPct.toFixed(0)}%</div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${barColor(globalPct)}`} style={{ width: `${Math.min(globalPct, 150)}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Estado global</div>
          <div className={`mt-1 text-lg font-semibold ${globalStatus.cls}`}>{globalStatus.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {effortMap[""] > 0 && <>· {effortMap[""]} h sin quarter</>}
          </div>
        </div>
      </div>

      {/* Capacidad por Q */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Esfuerzo vs Capacidad por Quarter</h3>
        <div className="space-y-3">
          {QUARTERS.map((q) => {
            const eff = effortMap[q];
            const cap = capacityPerQuarter(cfg, q);
            const pct = cap > 0 ? (eff / cap) * 100 : 0;
            return (
              <div key={q}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{q} <span className="text-xs text-muted-foreground">· {sprintsForQuarter(cfg, q)} sprints</span></span>
                  <span className="text-xs text-muted-foreground">{eff} / {cap.toFixed(0)} h ({pct.toFixed(0)}%)</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 150)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prioridades */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Distribución por prioridad (items)</h3>
          <div className="space-y-2">
            {Object.entries(prioCount).map(([p, n]) => {
              const total = items.length || 1;
              const pct = (n / total) * 100;
              return (
                <div key={p}>
                  <div className="flex justify-between text-xs">
                    <span>{p}</span><span className="text-muted-foreground">{n} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${prioColor(p)}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Esfuerzo por prioridad (horas)</h3>
          <div className="space-y-2">
            {Object.entries(prioEffort).map(([p, h]) => {
              const pct = (h / maxPrioEffort) * 100;
              return (
                <div key={p}>
                  <div className="flex justify-between text-xs">
                    <span>{p}</span><span className="text-muted-foreground">{h.toFixed(0)} h</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${prioColor(p)}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
