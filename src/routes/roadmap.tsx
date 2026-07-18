import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter, Priority,
  importCSV, toCSV, uid, defaultCapacity,
  capacityPerQuarter, capacityPerSprint,
  CapacityConfig, buildRoadmapView, effortByQuarter, sprintsForQuarter,
  rolledUpEffort, effortByPriority, countByPriority,
  descendantsOf, topAncestor, roadmapCoverage, normalizeItems,
} from "@/lib/roadmap";
import { fetchRoadmap, persistItems, persistCapacity, resetRoadmap } from "@/lib/roadmap.functions";
import { useServerFn } from "@tanstack/react-start";

import {
  ArrowLeft, Upload, Download, Plus, Trash2, FileSpreadsheet, Eye, EyeOff,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Minus, CornerDownRight,
  Settings2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { WORK_ITEM_ICONS, WorkItemIcon } from "@/lib/work-item-icons";


export const Route = createFileRoute("/roadmap")({
  head: () => ({ meta: [{ title: "Roadmap — RoadGate" }] }),
  component: RoadmapPage,
});

type RealQuarter = Exclude<Quarter, "">;
const QUARTERS: RealQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
const PRIORITIES: Priority[] = ["1-High", "2-Medium", "3-Low", "4-Lowest"];

const ENABLED_TYPES_KEY = "roadgate.roadmap.enabledTypes";
const ALL_TYPES: ItemType[] = ["epic", "feature", "story"];
const TYPE_LABEL: Record<ItemType, string> = { epic: "Epics", feature: "Features", story: "User Stories" };
function loadEnabledTypes(): ItemType[] {
  if (typeof window === "undefined") return ALL_TYPES;
  try {
    const raw = localStorage.getItem(ENABLED_TYPES_KEY);
    if (!raw) return ALL_TYPES;
    const parsed = JSON.parse(raw) as ItemType[];
    const filtered = parsed.filter((t) => ALL_TYPES.includes(t));
    return filtered.length ? filtered : ALL_TYPES;
  } catch { return ALL_TYPES; }
}
function saveEnabledTypes(types: ItemType[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENABLED_TYPES_KEY, JSON.stringify(types));
}


function RoadmapPage() {
  const { session, ready } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [cfg, setCfg] = useState<CapacityConfig>(defaultCapacity);
  const [tab, setTab] = useState<ItemType>("epic");
  const [enabledTypes, setEnabledTypesState] = useState<ItemType[]>(ALL_TYPES);
  useEffect(() => { setEnabledTypesState(loadEnabledTypes()); }, []);
  useEffect(() => {
    if (!enabledTypes.includes(tab) && enabledTypes.length) setTab(enabledTypes[0]);
  }, [enabledTypes, tab]);
  const setEnabledTypes = (types: ItemType[]) => {
    const next = types.length ? types : ALL_TYPES;
    setEnabledTypesState(next);
    saveEnabledTypes(next);
  };

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  const fetchRoadmapFn = useServerFn(fetchRoadmap);
  const persistItemsFn = useServerFn(persistItems);
  const persistCapacityFn = useServerFn(persistCapacity);
  const resetRoadmapFn = useServerFn(resetRoadmap);

  // Hydrate from Supabase whenever the session identity changes.
  useEffect(() => {
    if (!session?.userId) { setItems([]); setCfg(defaultCapacity); return; }
    let cancelled = false;
    fetchRoadmapFn()
      .then((r) => { if (!cancelled) { setItems(r.items); setCfg(r.capacity); } })
      .catch((e) => { console.error(e); toast.error("No se pudieron cargar los datos"); });
    return () => { cancelled = true; };
  }, [session?.userId, fetchRoadmapFn]);

  // Debounced persistence so bursts of edits collapse into a single write.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = (next: RoadmapItem[]) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistItemsFn({ data: { items: next } }).catch((e) => {
        console.error(e); toast.error("Error al guardar en Lovable Cloud");
      });
    }, 350);
  };
  useEffect(() => () => { if (persistTimer.current) clearTimeout(persistTimer.current); }, []);

  const update = (next: RoadmapItem[]) => {
    const normalized = normalizeItems(next);
    setItems(normalized);
    schedulePersist(normalized);
  };

  const updateOne = (uidKey: string, patch: Partial<RoadmapItem>) => {
    const current = items.find((i) => i.uid === uidKey);
    if (!current) return;
    const safePatch = { ...patch };
    // Nunca permitir sobrescribir el tipo original
    if ("type" in safePatch) delete (safePatch as { type?: ItemType }).type;
    // Gate de priorización: no permitir asignar Quarter sin prioridad definida
    if ("quarter" in safePatch && safePatch.quarter && !current.priority) {
      toast.error("No se puede añadir al Roadmap sin prioridad", {
        description: "Define la prioridad antes de asignar un Quarter.",
      });
      delete safePatch.quarter;
    }
    // Validar parentId según el tipo
    if ("parentId" in safePatch) {
      const pid = safePatch.parentId;
      if (pid) {
        const parent = items.find((i) => i.id === pid);
        const allowed =
          current.type === "feature" ? parent?.type === "epic"
          : current.type === "story" ? (parent?.type === "epic" || parent?.type === "feature")
          : false;
        if (!allowed) {
          toast.error("Padre no permitido para este tipo de tarea");
          delete safePatch.parentId;
        }
      }
    }
    if (Object.keys(safePatch).length === 0) return;
    update(items.map((it) => (it.uid === uidKey ? { ...it, ...safePatch } : it)));
  };
  /** Move an item to a quarter. Cascade non-destructive: solo desciende a hijos que compartían el Q previo. */
  const moveQuarter = (uidKey: string, quarter: Quarter) => {
    const target = items.find((i) => i.uid === uidKey);
    if (!target) return;
    if (target.quarter === quarter) return;
    // Gate de priorización
    if (quarter && !target.priority) {
      toast.error("No se puede añadir al Roadmap sin prioridad", {
        description: `${target.id}: define la prioridad antes de asignar un Quarter.`,
      });
      return;
    }
    const prevQ = target.quarter ?? "";
    const cascadeUids = new Set<string>([target.uid]);
    descendantsOf(target, items).forEach((d) => {
      if ((d.quarter ?? "") === prevQ) cascadeUids.add(d.uid);
    });
    update(items.map((it) => (cascadeUids.has(it.uid) ? { ...it, quarter } : it)));
    toast.success(quarter ? `Movido a ${quarter}` : "Movido a Backlog", {
      description: `${target.id}: ${target.title}`,
    });
  };
  const remove = (uidKey: string) => update(items.filter((it) => it.uid !== uidKey));
  const add = (type: ItemType) => {
    const prefix = type === "epic" ? "EPIC" : type === "feature" ? "FEAT" : "US";
    const used = new Set(items.filter((i) => i.type === type).map((i) => i.id));
    let n = items.filter((i) => i.type === type).length + 1;
    let newId = `${prefix}-${String(n).padStart(2, "0")}`;
    while (used.has(newId)) { n += 1; newId = `${prefix}-${String(n).padStart(2, "0")}`; }
    update([...items, {
      uid: uid(), id: newId, type,
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <TabsList>
                  {enabledTypes.map((ty) => (
                    <TabsTrigger key={ty} value={ty}>
                      {TYPE_LABEL[ty]} ({items.filter((i) => i.type === ty).length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!window.confirm("¿Borrar todos los datos de demo (backlog, roadmap y capacidad) DE TU USUARIO? Esta acción no se puede deshacer.")) return;
                    try {
                      await resetRoadmapFn();
                      setItems([]);
                      setCfg(defaultCapacity);
                      toast.success("Tus datos han sido borrados");
                    } catch (e) {
                      console.error(e);
                      toast.error("Error al borrar los datos");
                    }
                  }}

                >
                  <Trash2 className="h-4 w-4" /> Reset demo data
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Settings2 className="h-4 w-4" /> Tipos de work item
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent align="end" className="w-64">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Elige los tipos que quieres usar
                    </div>
                    <div className="space-y-2">
                      {ALL_TYPES.map((ty) => {
                        const checked = enabledTypes.includes(ty);
                        const isLastEnabled = checked && enabledTypes.length === 1;
                        return (
                          <div key={ty} className="flex items-center gap-2">
                            <Checkbox
                              id={`et-${ty}`}
                              checked={checked}
                              disabled={isLastEnabled}
                              onCheckedChange={(v) => {
                                const next = v
                                  ? [...enabledTypes, ty].filter((x, i, a) => a.indexOf(x) === i)
                                  : enabledTypes.filter((x) => x !== ty);
                                setEnabledTypes(next.length ? next.sort((a, b) => ALL_TYPES.indexOf(a) - ALL_TYPES.indexOf(b)) : enabledTypes);
                              }}
                            />
                            <Label htmlFor={`et-${ty}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <WorkItemIcon type={ty} className="h-4 w-4" />
                              {TYPE_LABEL[ty]}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3">
                      Debe quedar al menos un tipo activo.
                    </p>
                  </PopoverContent>
                </Popover>
                </div>
              </div>

              {enabledTypes.map((ty) => (
                <TabsContent key={ty} value={ty} className="mt-4">
                  <BacklogPanel
                    type={ty}
                    items={items}
                    onAdd={() => add(ty)}
                    onUpdate={updateOne}
                    onMoveQuarter={moveQuarter}
                    onRemove={remove}
                    onImport={(csv) => update(importCSV(csv, ty, items))}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>


          <TabsContent value="roadmap" className="mt-6">
            <RoadmapView items={items} cfg={cfg} onMove={moveQuarter} onRestore={update} onUpdate={updateOne} />
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


function ParentPicker({
  value, parents, onChange,
}: {
  value?: string;
  parents: RoadmapItem[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parents.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm hover:bg-muted/40"
        >
          {selected ? (
            <span className="flex items-center gap-1 truncate">
              <WorkItemIcon type={selected.type} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selected.id} · {selected.title.slice(0, 30)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command
          filter={(val, search) => {
            if (!search) return 1;
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por ID o título..." className="h-9" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ ninguno sin padre"
                onSelect={() => { onChange(""); setOpen(false); }}
              >
                <span className="text-muted-foreground italic">— Sin padre —</span>
              </CommandItem>
              {parents.map((p) => (
                <CommandItem
                  key={p.uid}
                  value={`${p.id} ${p.title}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <WorkItemIcon type={p.type} className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{p.id}</span>
                  <span className="truncate text-xs">{p.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


function IdInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const commit = () => {
    const trimmed = local.trim();
    if (!trimmed) { setLocal(value); return; } // no permitir ID vacío: revertir
    if (trimmed !== value) onCommit(trimmed);
  };
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder="ID"
      className="h-8 px-2 text-xs font-mono font-semibold"
    />
  );
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
  const parents = items.filter((i) =>
    type === "feature" ? i.type === "epic"
    : type === "story" ? (i.type === "epic" || i.type === "feature")
    : false
  );

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
                        <IdInput
                          value={it.id}
                          onCommit={(v) => onUpdate(it.uid, { id: v })}
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
                          <ParentPicker
                            value={it.parentId}
                            parents={parents}
                            onChange={(v) => onUpdate(it.uid, { parentId: v || undefined })}
                          />
                        </td>
                      )}
                      <td>
                        {hasKids ? (
                          <div
                            className="h-8 flex items-center justify-end px-2 text-xs text-muted-foreground bg-muted/30 rounded-md border border-dashed border-border cursor-not-allowed"
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

function RoadmapView({ items, cfg, onMove, onRestore, onUpdate }: { items: RoadmapItem[]; cfg: CapacityConfig; onMove: (uid: string, quarter: Quarter) => void; onRestore: (next: RoadmapItem[]) => void; onUpdate: (uid: string, patch: Partial<RoadmapItem>) => void }) {
  const { t } = useI18n();
  const view = useMemo(() => buildRoadmapView(items), [items]);
  const effortMap = useMemo(() => effortByQuarter(items), [items]);
  const capSprint = capacityPerSprint(cfg);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [overQ, setOverQ] = useState<Quarter | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<{ items: RoadmapItem[]; fromQ: Quarter; toQ: Quarter; id: string } | null>(null);
  const [pending, setPending] = useState<{ uid: string; q: Quarter } | null>(null);
  const [pendPriority, setPendPriority] = useState<Priority>("");
  const [pendEffort, setPendEffort] = useState<string>("");

  const byQuarter = useMemo(() => {
    const map: Record<Quarter, { item: RoadmapItem; quarter: Quarter; rolledUp: boolean }[]> =
      { Q1: [], Q2: [], Q3: [], Q4: [], "": [] };
    view.forEach((v) => map[v.quarter].push(v));
    return map;
  }, [view]);

  const commitMove = (uidKey: string, q: Quarter) => {
    const target = items.find((i) => i.uid === uidKey);
    const fromQ = (target?.quarter ?? "") as Quarter;
    if (target && fromQ !== q) {
      setLastSnapshot({ items, fromQ, toQ: q, id: target.id });
    }
    onMove(uidKey, q);
  };

  const handleDrop = (q: Quarter, restrictType?: ItemType) => {
    if (dragUid) {
      const target = items.find((i) => i.uid === dragUid);
      if (target) {
        if (restrictType && target.type !== restrictType) {
          const labels: Record<ItemType, string> = { epic: "Epics", feature: "Features", story: "User Stories" };
          toast.error("Movimiento no permitido", {
            description: `Solo puedes soltar ${labels[restrictType]} en esta columna.`,
          });
          setDragUid(null);
          setOverQ(null);
          return;
        }
        // Gate estricto de priorización: bloquear el movimiento a un Quarter sin prioridad
        if (q !== "" && !target.priority) {
          toast.error("No se puede añadir al Roadmap sin prioridad", {
            description: `${target.id}: define la prioridad en la vista de Backlog antes de mover a ${q}.`,
          });
          setDragUid(null);
          setOverQ(null);
          return;
        }
      }
      commitMove(dragUid, q);
    }
    setDragUid(null);
    setOverQ(null);
  };

  const confirmPending = () => {
    if (!pending) return;
    const target = items.find((i) => i.uid === pending.uid);
    if (!target) { setPending(null); return; }
    const hasKids = items.some((c) => c.parentId === target.id);
    const patch: Partial<RoadmapItem> = {};
    if (!target.priority && pendPriority) patch.priority = pendPriority;
    if (!hasKids) {
      const n = Number(pendEffort);
      if (n > 0) patch.effort = n;
    }
    if (Object.keys(patch).length) onUpdate(pending.uid, patch);
    commitMove(pending.uid, pending.q);
    setPending(null);
  };

  const pendingItem = pending ? items.find((i) => i.uid === pending.uid) : null;
  const pendingHasKids = pendingItem ? items.some((c) => c.parentId === pendingItem.id) : false;
  const pendingValid =
    !!pendPriority &&
    (pendingHasKids ? rolledUpEffort(pendingItem!, items) > 0 : Number(pendEffort) > 0);

  const undo = () => {
    if (!lastSnapshot) return;
    onRestore(lastSnapshot.items);
    setLastSnapshot(null);
  };

  const priorityColor = (p?: Priority) =>
    p === "1-High" ? "bg-destructive/15 text-destructive border-destructive/30"
    : p === "2-Medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : p === "3-Low" ? "bg-muted text-muted-foreground border-border"
    : "bg-muted text-muted-foreground border-border";


  const barColor = (pct: number) =>
    pct === 0 ? "bg-muted"
    : pct > 100 ? "bg-destructive"
    : pct < 50 ? "bg-amber-500" : "bg-emerald-500";


  return (
    <div className="space-y-6">
      {lastSnapshot && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {lastSnapshot.id}: {lastSnapshot.fromQ || "Sin quarter"} → {lastSnapshot.toQ || "Sin quarter"}
          </span>
          <Button variant="outline" size="sm" onClick={undo}>
            <ArrowLeft className="h-3.5 w-3.5" /> Deshacer
          </Button>
        </div>
      )}
      {/* Una sola tarjeta por Quarter: KPI + items */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {QUARTERS.map((q) => {
          const eff = effortMap[q];
          const cap = capacityPerQuarter(cfg, q);
          const pct = cap > 0 ? (eff / cap) * 100 : 0;
          const cell = byQuarter[q];
          const status =
            pct === 0 ? { label: t("roadmap.status.empty"), cls: "text-muted-foreground" }
            : pct > 100 ? { label: t("roadmap.status.overload"), cls: "text-destructive" }
            : pct < 50 ? { label: t("roadmap.status.under"), cls: "text-amber-600 dark:text-amber-400" }
            : { label: t("roadmap.status.ok"), cls: "text-emerald-600 dark:text-emerald-400" };

          return (
            <div
              key={q}
              onDragOver={(e) => { e.preventDefault(); setOverQ(q); }}
              onDragLeave={() => setOverQ((prev) => (prev === q ? null : prev))}
              onDrop={() => handleDrop(q)}
              className={`rounded-xl border bg-card flex flex-col transition-colors ${overQ === q ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
            >
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
              <div className="p-3 space-y-2 min-h-[80px] flex-1">
                {cell.length === 0 && (
                  <div className="text-xs text-muted-foreground/60 text-center py-6">—</div>
                )}
                {cell.map((v) => {
                  const it = v.item;
                  const top = topAncestor(it, items);
                  const cov = top ? roadmapCoverage(top, items) : null;
                  const showParent = !!top && cov !== null && cov.pct < 100 - 0.5;
                  return (
                    <div
                      key={it.uid}
                      draggable
                      onDragStart={(e) => { setDragUid(it.uid); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragUid(null); setOverQ(null); }}
                      className={`rounded-md border p-2 text-xs cursor-grab active:cursor-grabbing transition-opacity ${WORK_ITEM_ICONS[it.type].badgeClass} ${dragUid === it.uid ? "opacity-40" : ""}`}
                    >
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
                      <div className="flex items-center justify-between mt-1 gap-2">
                        {(() => {
                          const eff = v.rolledUp ? rolledUpEffort(it, items) : (it.effort ?? 0);
                          return eff > 0
                            ? <span className="text-[10px] text-muted-foreground">{v.rolledUp ? "Σ " : ""}{eff}h</span>
                            : <span />;
                        })()}
                        <Select
                          value={it.quarter || "__bl"}
                          onValueChange={(val) => commitMove(it.uid, (val === "__bl" ? "" : val) as Quarter)}
                        >
                          <SelectTrigger
                            className="h-6 w-[74px] text-[10px] px-1.5"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue placeholder="Q?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__bl" className="text-xs">Sin Q</SelectItem>
                            {QUARTERS.map((qq) => (
                              <SelectItem key={qq} value={qq} className="text-xs">{qq}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>


      {byQuarter[""].length > 0 && (() => {
        const unassigned = byQuarter[""];
        const groups: { type: ItemType; label: string }[] = [
          { type: "epic", label: "Epics" },
          { type: "feature", label: "Features" },
          { type: "story", label: "User Stories" },
        ];
        return (
          <div>
            <h4 className="font-semibold text-foreground mb-2">
              {t("roadmap.noQuarterAssigned")} ({unassigned.length})
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              {groups.map((g) => {
                const list = unassigned.filter((v) => v.item.type === g.type);
                return (
                  <div
                    key={g.type}
                    onDragOver={(e) => { e.preventDefault(); setOverQ(""); }}
                    onDragLeave={() => setOverQ((prev) => (prev === "" ? null : prev))}
                    onDrop={() => handleDrop("", g.type)}
                    className={`rounded-xl border border-dashed bg-card/60 p-3 min-h-[120px] transition-colors ${overQ === "" ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <WorkItemIcon type={g.type} className="h-4 w-4" />
                        {g.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{list.length}</span>
                    </div>
                    {list.length === 0 ? (
                      <div className="text-xs text-muted-foreground/60 text-center py-4">—</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {list.map((v) => {
                          const hasKids = items.some((c) => c.parentId === v.item.id);
                          const eff = hasKids ? rolledUpEffort(v.item, items) : (v.item.effort ?? 0);
                          const incomplete = !v.item.priority || eff <= 0;
                          return (
                            <div
                              key={v.item.uid}
                              draggable
                              onDragStart={(e) => { setDragUid(v.item.uid); e.dataTransfer.effectAllowed = "move"; }}
                              onDragEnd={() => { setDragUid(null); setOverQ(null); }}
                              className={`cursor-grab active:cursor-grabbing ${dragUid === v.item.uid ? "opacity-40" : ""}`}
                              title={incomplete ? "Falta prioridad o esfuerzo" : ""}
                            >
                              <Badge variant="outline" className={`${WORK_ITEM_ICONS[v.item.type].badgeClass} ${incomplete ? "ring-1 ring-amber-500/60" : ""}`}>
                                {v.item.id} · {v.item.title}
                                {incomplete && <span className="ml-1 text-amber-600 dark:text-amber-400">⚠</span>}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar antes de añadir al Roadmap</DialogTitle>
            <DialogDescription>
              {pendingItem ? `${pendingItem.id} · ${pendingItem.title}` : ""} requiere prioridad
              {pendingHasKids ? "" : " y esfuerzo"} para ubicarse en {pending?.q}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Prioridad</label>
              <Select value={pendPriority || undefined} onValueChange={(v) => setPendPriority(v as Priority)}>
                <SelectTrigger><SelectValue placeholder="Selecciona prioridad" /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Esfuerzo (h)</label>
              {pendingHasKids ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-md px-3 py-2 bg-muted/30">
                  Σ {pendingItem ? rolledUpEffort(pendingItem, items) : 0} h (suma de hijos)
                </div>
              ) : (
                <Input type="number" min={0} value={pendEffort} onChange={(e) => setPendEffort(e.target.value)} placeholder="Ej. 8" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
            <Button onClick={confirmPending} disabled={!pendingValid}>Guardar y mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    : pct > 100 ? "bg-destructive"
    : pct < 50 ? "bg-amber-500" : "bg-emerald-500";


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
