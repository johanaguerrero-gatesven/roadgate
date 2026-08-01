/**
 * =============================================================================
 * RoadmapView — tablero trimestral (vista "Roadmap")
 * =============================================================================
 * Presentación pura: no contiene reglas de negocio, delega en las acciones
 * `onMove` / `onUpdate` que expone `useRoadmapBoard`.
 *
 * Qué resuelve esta vista:
 *  - Qué se pinta en cada columna: lo decide `buildRoadmapView(items)`.
 *      · Padre con toda su descendencia en el mismo Q → una tarjeta contenedora
 *        colapsable (chevron) que despliega el árbol de hijos.
 *      · Padre en "MULTI" (hijos repartidos) → NO se pinta; se pintan los hijos.
 *      · Sin planificar → zona "No quarter assigned", separada por tipo.
 *  - KPIs por Quarter: esfuerzo comprometido (`effortByQuarter`, solo hojas, sin
 *    doble conteo) frente a capacidad (`capacityPerQuarter`) y % de utilización.
 *  - Drag & drop nativo (HTML5) con snapshot para el banner de "Deshacer".
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CornerDownRight, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, ItemType, Quarter, Priority, CapacityConfig,
  buildRoadmapView, effortByQuarter, capacityPerQuarter, capacityPerSprint,
  sprintsForQuarter, rolledUpEffort, topAncestor, roadmapCoverage,
} from "@/lib/roadmap";
import { WORK_ITEM_ICONS, WorkItemIcon } from "@/lib/work-item-icons";
import { PRIORITIES, QUARTERS, hasAssignedPriority, utilizationBarColor } from "../constants";
import { PriorityPicker } from "./PriorityPicker";
import { ItemDetailDialog } from "./ItemDetailDialog";

/** Tablero trimestral con drag & drop, KPIs por Quarter y zona de items sin asignar. */
export function RoadmapView({
  items, cfg, onMove, onRestore, onUpdate,
}: {
  items: RoadmapItem[];
  cfg: CapacityConfig;
  onMove: (uid: string, quarter: Quarter) => void;
  onRestore: (next: RoadmapItem[]) => void;
  onUpdate: (uid: string, patch: Partial<RoadmapItem>) => void;
}) {
  const { t } = useI18n();
  const view = useMemo(() => buildRoadmapView(items), [items]);
  const effortMap = useMemo(() => effortByQuarter(items), [items]);
  const capSprint = capacityPerSprint(cfg);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [overQ, setOverQ] = useState<Quarter | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<{ items: RoadmapItem[]; fromQ: Quarter; toQ: Quarter; id: string } | null>(null);
  const [pending, setPending] = useState<{ uid: string; q: Quarter } | null>(null);
  const [detailUid, setDetailUid] = useState<string | null>(null);
  // Tarjetas contenedoras (padres) colapsadas por defecto.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (uidKey: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uidKey)) next.delete(uidKey); else next.add(uidKey);
      return next;
    });

  /** Árbol de descendientes renderizado dentro de una tarjeta contenedora. */
  const ChildTree = ({ parent, depth = 0 }: { parent: RoadmapItem; depth?: number }) => {
    const kids = items.filter((c) => c.parentId === parent.id);
    if (kids.length === 0) return null;
    return (
      <div className="mt-1 space-y-1">
        {kids.map((k) => (
          <div key={k.uid}>
            <div
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
              style={{ paddingLeft: depth * 10 }}
              onClick={(e) => { e.stopPropagation(); setDetailUid(k.uid); }}
            >
              <WorkItemIcon type={k.type} className="h-3 w-3 shrink-0" />
              <span className="font-medium shrink-0">{k.id}</span>
              <span className="truncate">{k.title}</span>
              <span className="ml-auto shrink-0">{rolledUpEffort(k, items) || 0}h</span>
            </div>
            <ChildTree parent={k} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  };



  const [pendPriority, setPendPriority] = useState<Priority>("");
  const [pendEffort, setPendEffort] = useState<string>("");

  const byQuarter = useMemo(() => {
    const map: Record<Quarter, { item: RoadmapItem; quarter: Quarter; rolledUp: boolean }[]> =
      { Q1: [], Q2: [], Q3: [], Q4: [], MULTI: [], "": [] };
    // "MULTI" nunca se renderiza como tarjeta: sus hijos ya aparecen en sus Quarters.
    view.forEach((v) => { if (v.quarter !== "MULTI") map[v.quarter].push(v); });
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
        // Sin gate de prioridad: al planificar, el hook fuerza prioridad Alta en cascada.
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
    if (!hasAssignedPriority(target.priority) && hasAssignedPriority(pendPriority)) patch.priority = pendPriority;
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
    hasAssignedPriority(pendPriority) &&
    (pendingHasKids ? rolledUpEffort(pendingItem!, items) > 0 : Number(pendEffort) > 0);

  const undo = () => {
    if (!lastSnapshot) return;
    onRestore(lastSnapshot.items);
    setLastSnapshot(null);
  };

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
                  <div className={`h-full ${utilizationBarColor(pct)}`} style={{ width: `${Math.min(pct, 150)}%` }} />
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
                      onClick={() => setDetailUid(it.uid)}
                      className={`rounded-md border p-2 text-xs cursor-grab active:cursor-grabbing transition-opacity hover:ring-2 hover:ring-primary/40 ${WORK_ITEM_ICONS[it.type].badgeClass} ${dragUid === it.uid ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1 font-semibold">
                          {v.rolledUp && (
                            <button
                              type="button"
                              className="rounded hover:bg-foreground/10 p-0.5 -ml-0.5"
                              title={expanded.has(it.uid) ? "Colapsar" : "Expandir hijos"}
                              onClick={(e) => { e.stopPropagation(); toggleExpanded(it.uid); }}
                            >
                              {expanded.has(it.uid)
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />}
                            </button>
                          )}
                          <WorkItemIcon type={it.type} className="h-3.5 w-3.5" />
                          {it.id}
                        </span>
                        <PriorityPicker
                          value={it.priority}
                          onChange={(p) => onUpdate(it.uid, { priority: p })}
                        />
                      </div>
                      <div className="text-foreground mt-0.5 line-clamp-2">{it.title}</div>
                      {v.rolledUp && expanded.has(it.uid) && (
                        <div className="mt-1 border-l border-border/60 pl-2">
                          <ChildTree parent={it} />
                        </div>
                      )}
                      {showParent && top && cov && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground" title={`${cov.planned}h / ${cov.total}h of ${top.id} planned in roadmap`}>
                          <CornerDownRight className="h-3 w-3" />
                          <span className="font-medium">{top.id}</span>
                          <span>· {cov.pct.toFixed(0)}% in roadmap</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1 gap-2">
                        {(() => {
                          const e2 = v.rolledUp ? rolledUpEffort(it, items) : (it.effort ?? 0);
                          return e2 > 0
                            ? <span className="text-[10px] text-muted-foreground">{v.rolledUp ? "Σ " : ""}{e2}h</span>
                            : <span />;
                        })()}
                        <Select
                          value={(it.quarter || v.quarter || q) || "__bl"}
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
          <div id="unassigned-section" className="scroll-mt-4">
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
                      <div className="flex flex-col gap-2">
                        {list.map((v) => {
                          const hasKids = items.some((c) => c.parentId === v.item.id);
                          const eff = hasKids ? rolledUpEffort(v.item, items) : (v.item.effort ?? 0);
                          const missingPriority = !hasAssignedPriority(v.item.priority);
                          const missingEffort = eff <= 0;
                          // Planificar ya no requiere prioridad previa: se fuerza Alta al mover.
                          const canAssignQuarter = true;
                          return (
                            <div
                              key={v.item.uid}
                              draggable
                              onDragStart={(e) => { setDragUid(v.item.uid); e.dataTransfer.effectAllowed = "move"; }}
                              onDragEnd={() => { setDragUid(null); setOverQ(null); }}
                              className={`cursor-grab active:cursor-grabbing flex items-center gap-1 ${dragUid === v.item.uid ? "opacity-40" : ""}`}
                              title={missingPriority ? "Falta prioridad" : missingEffort ? "Falta esfuerzo" : ""}
                            >
                              <Badge variant="outline" className={`${WORK_ITEM_ICONS[v.item.type].badgeClass} ${missingPriority ? "ring-1 ring-amber-500/60" : ""} flex items-center gap-1 flex-1 min-w-0`}>
                                <PriorityPicker
                                  value={v.item.priority}
                                  onChange={(p) => onUpdate(v.item.uid, { priority: p })}
                                  size="md"
                                />
                                <span
                                  className="truncate cursor-pointer hover:underline"
                                  onClick={(e) => { e.stopPropagation(); setDetailUid(v.item.uid); }}
                                >{v.item.id} · {v.item.title}</span>

                                {(missingPriority || missingEffort) && (
                                  <span
                                    className="ml-1 text-amber-600 dark:text-amber-400 shrink-0 cursor-help"
                                    title={
                                      missingPriority && missingEffort
                                        ? `Falta prioridad y esfuerzo.\n\nEsfuerzo: ${hasKids ? `rolled-up de ${items.filter(c => c.parentId === v.item.id).length} hijo(s) = 0` : "no asignado en este item (leaf)"}.\nFuente: rolledUpEffort() en src/lib/roadmap.ts — suma recursiva del effort de los descendientes leaf.`
                                        : missingPriority
                                        ? "Falta prioridad. Asigna Alta/Media/Baja/Muy baja en el selector de prioridad."
                                        : hasKids
                                        ? `Effort rolled-up = 0.\n\nEste ${WORK_ITEM_ICONS[v.item.type].label} tiene ${items.filter(c => c.parentId === v.item.id).length} hijo(s) y ninguno tiene 'effort' > 0.\n\nCálculo: rolledUpEffort() en src/lib/roadmap.ts recorre los descendientes hasta las hojas y suma su campo 'effort'. Como todos son 0 (o vacío), la suma es 0.\n\nSolución: asigna 'effort' a los hijos (Features/User Stories) desde la vista Backlog. El padre heredará la suma automáticamente.`
                                        : `Effort = 0.\n\nEste ${WORK_ITEM_ICONS[v.item.type].label} no tiene hijos, así que su esfuerzo viene de su propio campo 'effort' (leaf). Actualmente está vacío o en 0.\n\nSolución: asigna un valor de 'effort' desde la vista Backlog.`
                                    }
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </Badge>

                              <Select
                                value={v.item.quarter || "__bl"}
                                disabled={!canAssignQuarter}
                                onValueChange={(val) => commitMove(v.item.uid, (val === "__bl" ? "" : val) as Quarter)}
                              >
                                <SelectTrigger
                                  className="h-6 w-[68px] text-[10px] px-1.5 shrink-0"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  title={canAssignQuarter ? "Asignar Quarter" : "Asigna una prioridad para poder mover al Roadmap"}
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

      <ItemDetailDialog
        item={detailUid ? items.find((i) => i.uid === detailUid) ?? null : null}
        items={items}
        onClose={() => setDetailUid(null)}
        onUpdate={onUpdate}
        onMove={commitMove}
      />
    </div>
  );
}
