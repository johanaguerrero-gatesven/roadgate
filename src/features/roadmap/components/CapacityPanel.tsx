/**
 * CapacityPanel — configuración de la capacidad del equipo.
 * Entradas: desarrolladores, % de dedicación, días por sprint, horas por día y
 * sprints por Quarter (con posibilidad de sobrescribir Quarter a Quarter).
 * Capacidad por sprint = devs x dedicación x días x horas.
 * Incluye el audit trail de cambios (quién, cuándo, valor anterior → nuevo).
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  CapacityConfig, capacityPerQuarter, capacityPerSprint, sprintsForQuarter,
  annualCapacity, setAnnualCapacity, clearHoursOverrides, isQuarterOverridden,
} from "@/lib/roadmap";

import { fetchCapacityHistory } from "@/lib/roadmap.functions";
import { QUARTERS } from "../constants";

type HistoryEntry = {
  id: string; field: string; oldValue: string | null; newValue: string | null; by: string; at: string;
};

/** Configuración de capacidad del equipo y su cálculo derivado. */
export function CapacityPanel({ cfg, roadmapId, onChange }: { cfg: CapacityConfig; roadmapId: string; onChange: (c: CapacityConfig) => void }) {

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
  const annual = annualCapacity(cfg);
  const hasOverrides = QUARTERS.some((q) => isQuarterOverridden(cfg, q));
  /**
   * Saneado de la entrada numérica: vaciar el campo o teclear texto producía
   * `NaN`, que se propagaba a los cálculos ("NaN h") y al guardado.
   */
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  /**
   * Audit trail: se recarga poco después de cada cambio de `cfg` (el guardado
   * va con debounce de 400 ms en el hook, así que esperamos algo más).
   */
  const historyFn = useServerFn(fetchCapacityHistory);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      historyFn({ data: { roadmapId } })
        .then((rows) => { if (alive) setHistory(rows as HistoryEntry[]); })
        .catch((e) => console.error(e));
    }, 900);
    return () => { alive = false; clearTimeout(timer); };
  }, [roadmapId, cfg, historyFn]);

  const fieldLabel = (f: string) => {
    const map: Record<string, string> = {
      developers: t("roadmap.cap.developers"),
      dedicationPct: t("roadmap.cap.dedication"),
      daysPerSprint: t("roadmap.cap.daysPerSprint"),
      hoursPerDay: t("roadmap.cap.hoursPerDay"),
      sprintsPerQuarter: t("roadmap.cap.sprintsPerQuarterDefault"),
    };
    if (f.startsWith("sprintsByQuarter.")) return `${t("roadmap.cap.sprintsByQuarter")} · ${f.split(".")[1]}`;
    return map[f] ?? f;
  };
  const val = (v: string | null) => (v == null || v === "" ? t("roadmap.cap.historyEmptyValue") : v);

  return (
    <div className="space-y-6">
    <div className="grid md:grid-cols-2 gap-6">

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="font-semibold text-foreground mb-2">{t("roadmap.cap.global")}</h3>
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3">
            <label className="text-sm text-muted-foreground">{f.label}</label>
            <Input
              type="number" min={0}
              value={cfg[f.key]}
              onChange={(e) => onChange({ ...cfg, [f.key]: num(e.target.value) })}
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
                  sprintsByQuarter: { ...(cfg.sprintsByQuarter || {}), [q]: num(e.target.value) },
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
        </dl>

        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">{t("roadmap.cap.manualHours")}</h4>
            {hasOverrides && (
              <Button variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => onChange(clearHoursOverrides(cfg))}>
                {t("roadmap.cap.resetHours")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("roadmap.cap.manualHoursHint")}</p>
          {QUARTERS.map((q) => (
            <div key={q} className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">
                {q}
                <span className="ml-2 text-[11px] uppercase tracking-wide">
                  {isQuarterOverridden(cfg, q)
                    ? t("roadmap.cap.manual")
                    : `${sprintsForQuarter(cfg, q)} ${t("roadmap.cap.sprints")}`}
                </span>
              </dt>
              <Input
                type="number" min={0} step="1"
                value={Math.round(capacityPerQuarter(cfg, q))}
                onChange={(e) => onChange({
                  ...cfg,
                  hoursByQuarter: { ...(cfg.hoursByQuarter || {}), [q]: num(e.target.value) },
                })}
                className="w-28 h-9"
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <dt className="text-sm font-semibold text-foreground">{t("roadmap.cap.annual")}</dt>
            <Input
              type="number" min={0} step="1"
              value={Math.round(annual)}
              onChange={(e) => onChange(setAnnualCapacity(cfg, num(e.target.value)))}
              className="w-28 h-9 font-semibold"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("roadmap.cap.annualHint")}</p>
        </div>
      </div>
    </div>


    <section className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-semibold text-foreground">{t("roadmap.cap.history")}</h3>
      <p className="text-xs text-muted-foreground mb-3">{t("roadmap.cap.historyHint")}</p>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("roadmap.cap.historyEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 font-medium">{t("roadmap.cap.historyAt")}</th>
                <th className="py-2 pr-4 font-medium">{t("roadmap.cap.historyBy")}</th>
                <th className="py-2 pr-4 font-medium">{t("roadmap.cap.historyField")}</th>
                <th className="py-2 font-medium">{t("roadmap.cap.historyChange")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-4 whitespace-nowrap text-muted-foreground">
                    {new Date(h.at).toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-4 whitespace-nowrap">{h.by || "—"}</td>
                  <td className="py-1.5 pr-4">{fieldLabel(h.field)}</td>
                  <td className="py-1.5 whitespace-nowrap">
                    <span className="text-muted-foreground line-through">{val(h.oldValue)}</span>
                    <span className="mx-2">→</span>
                    <span className="font-semibold text-foreground">{val(h.newValue)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </div>
  );
}

