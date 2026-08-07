import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { HarvestrRoadmapForm } from "@/components/HarvestrRoadmapForm";
import { getIntegrations, saveIntegrations, type Integration } from "@/lib/profile";
import { Plus, Check, Plug } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/integrations")({
  component: IntegrationsPage,
});

const CATALOG: Array<{ id: Integration["provider"]; name: string; descKey: string; available: boolean }> = [
  { id: "harvestr", name: "Harvestr", descKey: "integrations.harvestr.desc", available: true },
  { id: "jira", name: "Jira", descKey: "integrations.soon", available: false },
  { id: "slack", name: "Slack", descKey: "integrations.soon", available: false },
];

function IntegrationsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Integration[]>(() => getIntegrations());
  const [open, setOpen] = useState<Integration["provider"] | null>(null);
  const [apiKey, setApiKey] = useState("");

  const persist = (next: Integration[]) => {
    setItems(next);
    saveIntegrations(next);
  };

  const isConnected = (p: Integration["provider"]) => items.some((i) => i.provider === p && i.status === "connected");

  const connect = (p: Integration["provider"], name: string) => {
    const next: Integration[] = [
      ...items.filter((i) => i.provider !== p),
      {
        id: crypto.randomUUID(),
        provider: p,
        name,
        status: "connected",
        config: apiKey ? { apiKey } : undefined,
        createdAt: new Date().toISOString(),
      },
    ];
    persist(next);
    setOpen(null);
    setApiKey("");
    toast.success(t("settings.saved"));
  };

  const disconnect = (p: Integration["provider"]) => {
    persist(items.filter((i) => i.provider !== p));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("integrations.h1")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("integrations.lead")}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATALOG.map((c) => {
          const connected = isConnected(c.id);
          return (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Plug className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t(c.descKey as any)}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {connected ? (
                  <span className="inline-flex items-center gap-1 text-sm text-primary">
                    <Check className="h-4 w-4" /> {t("integrations.connected")}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {c.available ? "—" : t("integrations.soon")}
                  </span>
                )}
                {connected ? (
                  <Button size="sm" variant="outline" onClick={() => disconnect(c.id)}>
                    {t("integrations.disconnect")}
                  </Button>
                ) : (
                  <Button size="sm" disabled={!c.available} onClick={() => setOpen(c.id)}>
                    {t("integrations.connect")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className="rounded-xl border border-dashed border-border bg-card/40 p-5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          onClick={() => toast.info(t("integrations.soon"))}
        >
          <Plus className="h-4 w-4" /> {t("integrations.add")}
        </button>
      </div>

      <HarvestrRoadmapForm />

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open === "harvestr" ? "Harvestr" : open}</DialogTitle>
            <DialogDescription>
              {open === "harvestr" ? t("integrations.harvestr.desc") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>API Key</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="hv_xxx..."
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              app.harvestr.io → Settings → API
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>{t("settings.cancel")}</Button>
            <Button onClick={() => open && connect(open, open === "harvestr" ? "Harvestr" : String(open))}>
              {t("integrations.connect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
