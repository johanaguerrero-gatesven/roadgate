/**
 * Settings → Billing (Fase 5)
 * ---------------------------------------------------------------------------
 * Plan, estado de suscripción y asientos vienen SIEMPRE del backend
 * (`GET /billing/subscription`). Nada aquí es fuente de verdad: manipular
 * localStorage no cambia plan, límites ni permisos. El checkout sólo se ofrece
 * al Team Admin y, además, el servidor lo vuelve a verificar.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { fetchBillingState, startCheckout, type BillingState } from "@/lib/api/roadgate";
import { getBilling, type Billing } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/billing")({
  component: BillingPage,
});

const PLAN_KEYS = ["solo", "team", "business"] as const;

function BillingPage() {
  const { t, locale } = useI18n();
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [info] = useState<Billing>(() => getBilling());

  useEffect(() => {
    let cancelled = false;
    fetchBillingState()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-US") : "—";

  const onUpgrade = async () => {
    try {
      const res = await startCheckout({ plan: "team" });
      if (res.url) window.location.href = res.url;
    } catch {
      toast.info(t("billing.providerPending"));
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">{t("billing.loading")}</p>;
  if (error || !state)
    return <p className="text-sm text-destructive">{t("billing.error")}</p>;

  const isAdmin = state.role === "admin";
  const pct = state.seatLimit > 0 ? Math.min(100, (state.seatsUsed / state.seatLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      {state.readOnly && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
          <Lock className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden />
          <div>
            <div className="font-semibold">{t("billing.readOnlyTitle")}</div>
            <p className="text-sm text-muted-foreground mt-1">{t("billing.readOnlyBody")}</p>
          </div>
        </div>
      )}

      {state.overSeatLimit && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" aria-hidden />
          <div>
            <div className="font-semibold">{t("billing.overLimitTitle")}</div>
            <p className="text-sm text-muted-foreground mt-1">{t("billing.overLimitBody")}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("billing.yourPlan")}</h2>
          {isAdmin ? (
            <Button size="sm" onClick={onUpgrade}>
              {t("billing.upgrade")}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{t("billing.adminOnly")}</span>
          )}
        </div>

        <div className="p-6 grid sm:grid-cols-3 gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("billing.currentPlan")}
            </div>
            <div className="text-2xl font-bold mt-1">{t(`billing.plan.${state.plan}`)}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {t(`billing.plan.${state.plan}.desc`)}
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("billing.subscription")}
            </div>
            <div className="mt-1 font-semibold">
              {t(`billing.status.${state.effectiveStatus}`)}
            </div>
            <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
              {state.effectiveStatus === "trialing" && (
                <div>
                  {t("billing.trialEnds")} {fmt(state.trialEndsAt)}
                </div>
              )}
              {state.readOnly && state.graceEndsAt && (
                <div>
                  {t("billing.graceEnds")} {fmt(state.graceEndsAt)}
                </div>
              )}
              {state.effectiveStatus === "active" && state.currentPeriodEnd && (
                <div>
                  {t("billing.renews")} {fmt(state.currentPeriodEnd)}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {t("billing.seatsUsage")}
            </div>
            <div className="text-2xl font-bold mt-1">
              {state.seatsUsed} / {state.seatLimit}
            </div>
            <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className={`h-full ${state.overSeatLimit ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t("billing.seatsHint")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("billing.h1")}</h2>
        </div>
        <div className="p-6 grid sm:grid-cols-3 gap-4">
          {PLAN_KEYS.map((p) => (
            <div
              key={p}
              className={`rounded-lg border p-4 ${
                p === state.plan ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="font-semibold">{t(`billing.plan.${p}`)}</div>
              <p className="text-sm text-muted-foreground mt-1">{t(`billing.plan.${p}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("billing.info")}</h2>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="font-medium">{info.contactName || "—"}</div>
            <div className="text-muted-foreground">{info.contactEmail || "—"}</div>
            <div className="text-muted-foreground">Tax# {info.taxId || "—"}</div>
          </div>
          <div className="text-muted-foreground whitespace-pre-line">{info.address || "—"}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] p-6 text-sm text-muted-foreground">
        {t("billing.providerPending")}
      </div>
    </div>
  );
}
