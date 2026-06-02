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

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter, Priority,
  loadItems, saveItems, importCSV, toCSV, uid,
  loadCapacity, saveCapacity, capacityPerQuarter, capacityPerSprint,
  CapacityConfig, buildRoadmapView, effortByQuarter, sprintsForQuarter,
  rolledUpEffort, effortByPriority, countByPriority,
  descendantsOf, topAncestor, roadmapCoverage,
} from "@/lib/roadmap";
import {
  ArrowLeft, Upload, Download, Plus, Trash2, FileSpreadsheet, Eye, EyeOff,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Minus, CornerDownRight,
} from "lucide-react";
import { WORK_ITEM_ICONS, WorkItemIcon } from "@/lib/work-item-icons";


export const Route = createFileRoute("/roadmap")({
  head: () => ({ meta: [{ title: "Roadmap — RoadGate" }] }),
  component: RoadmapPage,
});

type RealQuarter = Exclude<Quarter, "">;
const QUARTERS: RealQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
const PRIORITIES: Priority[] = ["1-High", "2-Medium", "3-Low", "4-Lowest"];


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
  /** Move an item to a quarter and cascade the same quarter to ALL its descendants. */
  const moveQuarter = (uidKey: string, quarter: Quarter) => {
    const target = items.find((i) => i.uid === uidKey);
    if (!target) return;
    const ids = new Set<string>([target.uid, ...descendantsOf(target, items).map((d) => d.uid)]);
    update(items.map((it) => (ids.has(it.uid) ? { ...it, quarter } : it)));
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
        <div className="mx-auto max-w-[1700px] px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app"><ArrowLeft className="h-4 w-4" /> App</Link>
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] px-6 py-8">
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
                    onMoveQuarter={moveQuarter}
                    onRemove={remove}
                    onImport={(csv) => update(importCSV(csv, t, items))}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="roadmap" className="mt-6">
            <RoadmapView items={items} cfg={cfg} onMove={moveQuarter} />
          </TabsContent>

          <TabsContent value="capacity" className="mt-6">
            <CapacityPanel cfg={cfg} onChange={(c) => { setCfg(c); saveCapacity(c); }} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// --- Priority visuals (Jira-style icons) ---
const PRIORITY_META: Record<Exclude<Priority, "">, { icon: typeof ChevronsUp; cls: string; label: string }> = {
  "1-High":   { icon: ChevronsUp,   cls: "text-red-600",     label: "High" },
  "2-Medium": { icon: ChevronUp,    cls: "text-amber-600",   label: "Medium" },
  "3-Low":    { icon: ChevronDown,  cls: "text-sky-600",     label: "Low" },
  "4-Lowest": { icon: ChevronsDown, cls: "text-slate-500",   label: "Lowest" },
};

function PriorityIcon({ p, className = "h-4 w-4" }: { p?: Priority; className?: string }) {
  if (!p) return <Minus className={`${className} text-muted-foreground/60`} />;
  const m = PRIORITY_META[p as Exclude<Priority, "">];
  const Icon = m.icon;
  return <Icon className={`${className} ${m.cls}`} />;
}


function BacklogPanel({
  type, items, onAdd, onUpdate, onMoveQuarter, onRemove, onImport,
}: {
  type: ItemType;
  items: RoadmapItem[];
  onAdd: () => void;
  onUpdate: (uid: string, patch: Partial<RoadmapItem>) => void;
  onMoveQuarter: (uid: string, quarter: Quarter) => void;
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
        <Button onClick={onAdd}><Plus className="h-4 w-4" /> {t("roadmap.add")}</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {t("roadmap.import")}
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> {t("roadmap.export")}
        </Button>
        <input
          ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {list.length} {type === "story" ? "user stories" : `${type}s`}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
          <h3 className="mt-3 font-semibold text-foreground">{t("roadmap.empty.title")} {type === "story" ? "user stories" : type + "s"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("roadmap.empty.lead")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold [&>th]:border-b [&>th]:border-border">
                  <th className="w-8"></th>
                  <th className="w-[110px]">ID</th>
                  <th className="min-w-[320px]">{t("roadmap.col.title")}</th>
                  {type !== "epic" && <th className="w-[150px]">{t("roadmap.col.parent")}</th>}
                  <th className="w-[80px] text-right">Effort</th>
                  <th className="w-[140px]">Priority</th>
                  <th className="w-[100px]">Quarter</th>
                  <th className="min-w-[220px]">Notes</th>
                  <th className="w-[60px] text-center">Show</th>
                  <th className="w-[44px]"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((it) => {
                  const hidden = !!it.hiddenFromRoadmap;
                  const hasKids = type !== "story" && items.some((c) => c.parentId === it.id);
                  return (
                    <tr
                      key={it.uid}
                      className={`group border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors [&>td]:px-2 [&>td]:py-1.5 [&>td]:align-top ${hidden ? "opacity-60" : ""}`}
                    >
                      <td className="text-center text-muted-foreground/50">
                        <WorkItemIcon type={it.type} className="h-4 w-4 inline" />
                      </td>
                      <td>
                        <Input
                          value={it.id}
                          onChange={(e) => onUpdate(it.uid, { id: e.target.value })}
                          className="h-8 px-2 text-xs font-mono font-semibold"
                        />
                      </td>
                      <td>
                        <Textarea
                          value={it.title}
                          onChange={(e) => onUpdate(it.uid, { title: e.target.value })}
                          rows={1}
                          className="min-h-[32px] text-sm leading-snug py-1.5 px-2 resize-y font-medium"
                          placeholder={t("roadmap.col.title")}
                        />
                        {hasKids && (
                          <div className="text-[10px] text-muted-foreground italic mt-1">
                            Σ {rolledUpEffort(it, items)}h ({t("roadmap.rollupTitle")})
                          </div>
                        )}
                      </td>
                      {type !== "epic" && (
                        <td>
                          <Select
                            value={it.parentId || ""}
                            onValueChange={(v) => onUpdate(it.uid, { parentId: v || undefined })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {parents.map((p) => (
                                <SelectItem key={p.uid} value={p.id} className="text-xs">
                                  {p.id} · {p.title.slice(0, 40)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      <td>
                        <Input
                          type="number" min={0}
                          value={it.effort ?? ""}
                          onChange={(e) => onUpdate(it.uid, {
                            effort: e.target.value === "" ? undefined : Number(e.target.value),
                          })}
                          placeholder="0"
                          className="h-8 text-xs text-right"
                        />
                      </td>
                      <td>
                        <Select
                          value={it.priority || ""}
                          onValueChange={(v) => onUpdate(it.uid, { priority: v as Priority })}
                        >
                          <SelectTrigger className="h-8 text-xs gap-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                            <SelectValue placeholder="—">
                              {it.priority && (
                                <span className="flex items-center gap-1.5">
                                  <PriorityIcon p={it.priority} />
                                  {PRIORITY_META[it.priority as Exclude<Priority, "">].label}
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => {
                              const m = PRIORITY_META[p as Exclude<Priority, "">];
                              return (
                                <SelectItem key={p} value={p} className="text-xs">
                                  <span className="flex items-center gap-2">
                                    <PriorityIcon p={p} /> {m.label}
                                  </span>
                                </SelectItem>
                              );
                            })}
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
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        <Textarea
                          value={it.notes || ""}
                          onChange={(e) => onUpdate(it.uid, { notes: e.target.value })}
                          rows={1}
                          className="min-h-[32px] text-xs leading-snug py-1.5 px-2 resize-y"
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

function CapacityPanel({ cfg, onChange }: { cfg: CapacityConfig; onChange: (c: CapacityConfig) => void }) {
  const { t } = useI18n();
  type NumKey = "developers" | "dedicationPct" | "daysPerSprint" | "hoursPerDay" | "sprintsPerQuarter";
  const fields: { key: NumKey; label: string }[] = [
    { key: "developers", label: t("roadmap.cap.developers") },
    { key: "dedicationPct", label: t("roadmap.cap.dedication") },
    { key: "daysPerSprint", label: t("roadmap.cap.daysPerSprint") },
    { key: "hoursPerDay", label: t("roadmap.cap.hoursPerDay") },
    { key: "sprintsPerQuarter", label: t("roadmap.cap.sprintsPerQuarterDefault") },
  ];
  const sprint = capacityPerSprint(cfg);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="font-semibold text-foreground mb-2">{t("roadmap.cap.global")}</h3>
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
          <h4 className="text-sm font-semibold text-foreground">{t("roadmap.cap.sprintsByQuarter")}</h4>
          <p className="text-xs text-muted-foreground">{t("roadmap.cap.sprintsByQuarterHint")}</p>
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
        <h3 className="font-semibold text-foreground mb-3">{t("roadmap.cap.calculated")}</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>{t("roadmap.cap.perSprint")}</dt><dd className="font-semibold">{sprint.toFixed(0)} h</dd></div>
          {QUARTERS.map((q) => (
            <div key={q} className="flex justify-between">
              <dt>{q} ({sprintsForQuarter(cfg, q)} {t("roadmap.cap.sprints")})</dt>
              <dd className="font-semibold">{capacityPerQuarter(cfg, q).toFixed(0)} h</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2">
            <dt>{t("roadmap.cap.annual")}</dt>
            <dd className="font-semibold">
              {QUARTERS.reduce((s, q) => s + capacityPerQuarter(cfg, q), 0).toFixed(0)} h
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function RoadmapView({ items, cfg, onMove }: { items: RoadmapItem[]; cfg: CapacityConfig; onMove: (uid: string, quarter: Quarter) => void }) {
  const { t } = useI18n();
  const view = useMemo(() => buildRoadmapView(items), [items]);
  const effortMap = useMemo(() => effortByQuarter(items), [items]);
  const capSprint = capacityPerSprint(cfg);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [overQ, setOverQ] = useState<Quarter | null>(null);

  const byQuarter = useMemo(() => {
    const map: Record<Quarter, { item: RoadmapItem; quarter: Quarter; rolledUp: boolean }[]> =
      { Q1: [], Q2: [], Q3: [], Q4: [], "": [] };
    view.forEach((v) => map[v.quarter].push(v));
    return map;
  }, [view]);

  const handleDrop = (q: Quarter) => {
    if (dragUid) onMove(dragUid, q);
    setDragUid(null);
    setOverQ(null);
  };

  const priorityColor = (p?: Priority) =>
    p === "1-High" ? "bg-destructive/15 text-destructive border-destructive/30"
    : p === "2-Medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : p === "3-Low" ? "bg-muted text-muted-foreground border-border"
    : "bg-muted text-muted-foreground border-border";


  const barColor = (pct: number) =>
    pct === 0 ? "bg-muted"
    : pct > 110 ? "bg-destructive"
    : pct < 90 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-6">
      {/* Una sola tarjeta por Quarter: KPI + items */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {QUARTERS.map((q) => {
          const eff = effortMap[q];
          const cap = capacityPerQuarter(cfg, q);
          const pct = cap > 0 ? (eff / cap) * 100 : 0;
          const cell = byQuarter[q];
          const status =
            pct === 0 ? { label: t("roadmap.status.empty"), cls: "text-muted-foreground" }
            : pct > 110 ? { label: t("roadmap.status.overload"), cls: "text-destructive" }
            : pct < 90 ? { label: t("roadmap.status.under"), cls: "text-amber-600 dark:text-amber-400" }
            : { label: t("roadmap.status.ok"), cls: "text-emerald-600 dark:text-emerald-400" };
          return (
            <div key={q} className="rounded-xl border border-border bg-card flex flex-col">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{q}</h3>
                  <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {sprintsForQuarter(cfg, q)} {t("roadmap.cap.sprints")} · {capSprint.toFixed(0)} h/sprint
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {eff} <span className="text-sm font-normal text-muted-foreground">/ {cap.toFixed(0)} h</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 150)}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {pct.toFixed(0)}% {t("roadmap.utilization")} · {cell.length} {t("roadmap.items")}
                </div>
              </div>
              <div className="p-3 space-y-2 min-h-[80px]">
                {cell.length === 0 && (
                  <div className="text-xs text-muted-foreground/60 text-center py-6">—</div>
                )}
                {cell.map((v) => {
                  const it = v.item;
                  const top = topAncestor(it, items);
                  const cov = top ? roadmapCoverage(top, items) : null;
                  const showParent = !!top && cov !== null && cov.pct < 100 - 0.5;
                  return (
                    <div key={it.uid} className={`rounded-md border p-2 text-xs ${WORK_ITEM_ICONS[it.type].badgeClass}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1 font-semibold">
                          <WorkItemIcon type={it.type} className="h-3.5 w-3.5" />
                          {it.id}
                        </span>
                        {it.priority && (
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${priorityColor(it.priority)}`}>
                            {it.priority.split("-")[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-foreground mt-0.5 line-clamp-2">{it.title}</div>
                      {showParent && top && cov && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground" title={`${cov.planned}h / ${cov.total}h of ${top.id} planned in roadmap`}>
                          <CornerDownRight className="h-3 w-3" />
                          <span className="font-medium">{top.id}</span>
                          <span>· {cov.pct.toFixed(0)}% in roadmap</span>
                        </div>
                      )}
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
            </div>
          );
        })}
      </div>


      {byQuarter[""].length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-4">
          <h4 className="font-semibold text-foreground mb-2">{t("roadmap.noQuarterAssigned")} ({byQuarter[""].length})</h4>
          <div className="flex flex-wrap gap-2">
            {byQuarter[""].map((v) => (
              <Badge key={v.item.uid} variant="outline" className={WORK_ITEM_ICONS[v.item.type].badgeClass}>
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
  const { t } = useI18n();
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
    globalPct === 0 ? { label: t("roadmap.status.empty"), cls: "text-muted-foreground" }
    : globalPct > 110 ? { label: t("roadmap.status.overloadAnnual"), cls: "text-destructive" }
    : globalPct < 90 ? { label: t("roadmap.status.underAnnual"), cls: "text-amber-600 dark:text-amber-400" }
    : { label: t("roadmap.status.balanced"), cls: "text-emerald-600 dark:text-emerald-400" };

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
          <div className="text-xs text-muted-foreground">{t("roadmap.dash.itemsTotal")}</div>
          <div className="mt-1 text-2xl font-bold">{items.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {counts.epic} {t("roadmap.dash.epics")} · {counts.feature} {t("roadmap.dash.features")} · {counts.story} {t("roadmap.dash.stories")}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("roadmap.dash.plannedEffort")}</div>
          <div className="mt-1 text-2xl font-bold">{totalEffort.toFixed(0)} h</div>
          <div className="mt-1 text-xs text-muted-foreground">{t("roadmap.dash.of")} {totalCap.toFixed(0)} h {t("roadmap.dash.available")}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("roadmap.dash.annualUtil")}</div>
          <div className="mt-1 text-2xl font-bold">{globalPct.toFixed(0)}%</div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${barColor(globalPct)}`} style={{ width: `${Math.min(globalPct, 150)}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("roadmap.dash.globalState")}</div>
          <div className={`mt-1 text-lg font-semibold ${globalStatus.cls}`}>{globalStatus.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {effortMap[""] > 0 && <>· {effortMap[""]} {t("roadmap.dash.noQuarterEff")}</>}
          </div>
        </div>
      </div>

      {/* Capacidad por Q */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">{t("roadmap.dash.effortVsCap")}</h3>
        <div className="space-y-3">
          {QUARTERS.map((q) => {
            const eff = effortMap[q];
            const cap = capacityPerQuarter(cfg, q);
            const pct = cap > 0 ? (eff / cap) * 100 : 0;
            return (
              <div key={q}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{q} <span className="text-xs text-muted-foreground">· {sprintsForQuarter(cfg, q)} {t("roadmap.cap.sprints")}</span></span>
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
          <h3 className="font-semibold text-foreground mb-4">{t("roadmap.dash.distItems")}</h3>
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
          <h3 className="font-semibold text-foreground mb-4">{t("roadmap.dash.effortByPrio")}</h3>
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
