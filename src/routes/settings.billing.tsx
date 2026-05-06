import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getBilling, saveBilling, type Billing } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/billing")({
  component: BillingPage,
});

const PLAN_LABEL: Record<Billing["plan"], string> = {
  free: "Free",
  starter: "Starter",
  business: "Business",
  enterprise: "Enterprise",
};

function BillingPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Billing>(() => getBilling());

  const cycle = () => {
    const order: Billing["plan"][] = ["free", "starter", "business", "enterprise"];
    const next = order[(order.indexOf(data.plan) + 1) % order.length];
    const updated: Billing = {
      ...data,
      plan: next,
      seats: next === "free" ? 1 : next === "starter" ? 2 : next === "business" ? 5 : 20,
      reviewerSeats: next === "free" ? 0 : next === "starter" ? 2 : next === "business" ? 5 : 20,
      pricePerYear: next === "free" ? 0 : next === "starter" ? 290 : next === "business" ? 1176 : 4900,
    };
    setData(updated);
    saveBilling(updated);
    toast.success(t("settings.saved"));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("billing.yourPlan")}</h2>
          <div className="flex gap-3">
            <button className="text-sm text-primary hover:underline" type="button">{t("billing.cancelPlan")}</button>
            <button className="text-sm text-primary hover:underline" type="button" onClick={cycle}>{t("billing.editPlan")}</button>
          </div>
        </div>
        <div className="p-6 grid sm:grid-cols-3 gap-4">
          <div>
            <div className="font-semibold">{PLAN_LABEL[data.plan]}</div>
            <div className="text-2xl font-bold mt-1">${data.pricePerYear.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t("billing.perYear")}</span></div>
          </div>
          <div className="text-sm">
            <div>{data.seats} {t("billing.seats")}</div>
            <div className="text-muted-foreground mt-1">{data.reviewerSeats} {t("billing.reviewerSeats")}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("billing.info")}</h2>
          <Button variant="outline" size="sm">{t("billing.editInfo")}</Button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="font-medium">{data.contactName || "—"}</div>
            <div className="text-muted-foreground">{data.contactEmail || "—"}</div>
            <div className="text-muted-foreground">Tax# {data.taxId || "—"}</div>
          </div>
          <div className="text-muted-foreground whitespace-pre-line">
            {data.address || "—"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("billing.payment")}</h2>
          <button className="text-sm text-primary hover:underline" type="button">{t("billing.updatePayment")}</button>
        </div>
        <div className="p-6 text-sm">
          {data.cardLast4 ? (
            <div className="flex items-center justify-between">
              <div><span className="font-medium">{t("billing.cardEnding")} {data.cardLast4}</span></div>
              <div className="text-muted-foreground">{t("billing.expires")} {data.cardExpires}</div>
            </div>
          ) : (
            <p className="text-muted-foreground">{t("billing.noCard")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
