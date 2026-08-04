/**
 * DashboardPanel — KPIs del roadmap.
 * Compara el esfuerzo comprometido con la capacidad disponible (anual y por
 * Quarter) y muestra la distribución de work items por prioridad.
 * Todos los números provienen del dominio (`effortByQuarter`, `capacityPerQuarter`),
 * nunca se recalculan aquí.
 *
 * Incluye tooltips informativos en cada tarjeta y una leyenda que aclara qué se
 * considera "Roadmap" y qué "Backlog", además de cómo se calcula cada métrica.
 */
import { useMemo, type ReactNode } from "react";
import { Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  RoadmapItem, CapacityConfig,
  effortByQuarter, countByPriority, effortByPriority,
  capacityPerQuarter, sprintsForQuarter, effectiveQuarter,
} from "@/lib/roadmap";
import { QUARTERS, utilizationBarColor, priorityBarColor } from "../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Pequeño icono de ayuda con tooltip explicativo. */
function InfoTip({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t(label)}
          className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-left font-normal leading-relaxed">
        {t(label)}
      </TooltipContent>
    </Tooltip>
  );
}

/** Cabecera de tarjeta con título y tooltip opcional. */
function CardTitle({ children, tip }: { children: ReactNode; tip?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="text-xs text-muted-foreground">{children}</div>
      {tip && (
        <InfoTip label={tip} />
      )}
    </div>
  );
}

/** KPIs anuales, utilización por Quarter y distribución por prioridad. */
export function DashboardPanel({ items, cfg }: { items: RoadmapItem[]; cfg: CapacityConfig }) {
  const { t } = useI18n();
  const effortMap = useMemo(() => effortByQuarter(items), [items]);
  const prioCount = useMemo(() => countByPriority(items), [items]);
  const prioEffort = useMemo(() => effortByPriority(items), [items]);

  const totalEffort = QUARTERS.reduce((s, q) => s + effortMap[q], 0);
  const backlogEffort = effortMap[""] || 0;
  const totalCap = QUARTERS.reduce((s, q) => s + capacityPerQuarter(cfg, q), 0);
  const globalPct = totalCap > 0 ? (totalEffort / totalCap) * 100 : 0;

  // Ítems planificados = con Quarter efectivo (Q1..Q4 o MULTI); el resto es backlog.
  const planned = useMemo(
    () => items.filter((i) => {
      const q = effectiveQuarter(i, items);
      return q !== "";
    }).length,
    [items],
  );
  const backlogCount = items.length - planned;

  const counts = {
    epic: items.filter((i) => i.type === "epic").length,
    feature: items.filter((i) => i.type === "feature").length,
    story: items.filter((i) => i.type === "story").length,
  };

  const globalStatus =
    globalPct === 0 ? { label: t("roadmap.status.empty"), cls: "text-muted-foreground" }
    : globalPct > 110 ? { label: t("roadmap.status.overloadAnnual"), cls: "text-destructive" }
    : globalPct < 90 ? { label: t("roadmap.status.underAnnual"), cls: "text-amber-600 dark:text-amber-400" }
    : { label: t("roadmap.status.balanced"), cls: "text-emerald-600 dark:text-emerald-400" };

  const maxPrioEffort = Math.max(1, ...Object.values(prioEffort));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Leyenda Roadmap vs Backlog */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{t("roadmap.dash.legend.title")}</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("roadmap.dash.legend.roadmap")}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{t("roadmap.dash.legend.roadmapDesc")}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("roadmap.dash.legend.backlog")}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{t("roadmap.dash.legend.backlogDesc")}</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs cabecera */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <CardTitle tip="roadmap.dash.tip.itemsTotal">{t("roadmap.dash.itemsTotal")}</CardTitle>
            <div className="mt-1 text-2xl font-bold">{items.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {planned} {t("roadmap.dash.inRoadmap")} · {backlogCount} {t("roadmap.dash.inBacklog")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {counts.epic} {t("roadmap.dash.epics")} · {counts.feature} {t("roadmap.dash.features")} · {counts.story} {t("roadmap.dash.stories")}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <CardTitle tip="roadmap.dash.tip.plannedEffort">{t("roadmap.dash.plannedEffort")}</CardTitle>
            <div className="mt-1 text-2xl font-bold">{totalEffort.toFixed(0)} h</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("roadmap.dash.of")} {totalCap.toFixed(0)} h {t("roadmap.dash.available")}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t("roadmap.dash.plannedHint")}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <CardTitle tip="roadmap.dash.tip.annualUtil">{t("roadmap.dash.annualUtil")}</CardTitle>
            <div className="mt-1 text-2xl font-bold">{globalPct.toFixed(0)}%</div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${utilizationBarColor(globalPct)}`} style={{ width: `${Math.min(globalPct, 150)}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">{t("roadmap.dash.utilScope")}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <CardTitle tip="roadmap.dash.tip.globalState">{t("roadmap.dash.globalState")}</CardTitle>
            <div className={`mt-1 text-lg font-semibold ${globalStatus.cls}`}>{globalStatus.label}</div>
            {backlogEffort > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {backlogEffort.toFixed(0)} {t("roadmap.dash.noQuarterEff")} · {t("roadmap.dash.backlogNote")}
              </div>
            )}
          </div>
        </div>


        {/* Capacidad por Q */}
        <div className="rounded-xl border border-border bg-card p-6">
          <CardTitle tip="roadmap.dash.tip.effortVsCap">
            <h3 className="font-semibold text-foreground">{t("roadmap.dash.effortVsCap")}</h3>
          </CardTitle>
          <div className="mt-4 space-y-3">
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
                    <div className={`h-full ${utilizationBarColor(pct)}`} style={{ width: `${Math.min(pct, 150)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prioridades */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <CardTitle tip="roadmap.dash.tip.distItems">
              <h3 className="font-semibold text-foreground">{t("roadmap.dash.distItems")}</h3>
            </CardTitle>
            <div className="mt-4 space-y-2">
              {Object.entries(prioCount).map(([p, n]) => {
                const total = items.length || 1;
                const pct = (n / total) * 100;
                return (
                  <div key={p}>
                    <div className="flex justify-between text-xs">
                      <span>{p}</span><span className="text-muted-foreground">{n} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${priorityBarColor(p)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <CardTitle tip="roadmap.dash.tip.effortByPrio">
              <h3 className="font-semibold text-foreground">{t("roadmap.dash.effortByPrio")}</h3>
            </CardTitle>
            <div className="mt-4 space-y-2">
              {Object.entries(prioEffort).map(([p, h]) => {
                const pct = (h / maxPrioEffort) * 100;
                return (
                  <div key={p}>
                    <div className="flex justify-between text-xs">
                      <span>{p}</span><span className="text-muted-foreground">{h.toFixed(0)} h</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${priorityBarColor(p)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
