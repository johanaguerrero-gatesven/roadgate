/**
 * =============================================================================
 * Ajustes · API keys (Fase 4)
 * =============================================================================
 * Pantalla de gestión de credenciales de integración. Consume la misma API
 * pública que cualquier integrador (`/api/public/v1/api-keys`), con la sesión
 * del usuario como credencial: una API key no puede emitir otras claves.
 *
 * El secreto en claro sólo existe en la respuesta de creación, así que se
 * muestra en un diálogo con botón de copiar y no se persiste en el cliente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  type ApiKeySummary,
} from "@/lib/api/roadgate";
import { KeyRound, Copy, Plus, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/api-keys")({
  component: ApiKeysPage,
});

/** Estado derivado de una clave para pintar el badge de la tabla. */
function keyStatus(k: ApiKeySummary): "active" | "revoked" | "expired" {
  if (k.revokedAt) return "revoked";
  if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

function ApiKeysPage() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setKeys(await listApiKeys());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async () => {
    const scopes = [
      ...(canRead ? ["roadmaps:read"] : []),
      ...(canWrite ? ["roadmaps:write"] : []),
    ];
    if (!name.trim() || scopes.length === 0) return;
    setSaving(true);
    try {
      const days = Number(expiresInDays);
      const res = await createApiKey({
        name: name.trim(),
        scopes,
        ...(Number.isFinite(days) && days > 0 ? { expiresInDays: Math.floor(days) } : {}),
      });
      setSecret(res.key);
      setOpen(false);
      setName("");
      setExpiresInDays("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (keyId: string) => {
    await revokeApiKey({ keyId });
    await refresh();
  };

  const onDelete = async (keyId: string) => {
    await deleteApiKey({ keyId });
    await refresh();
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t("apikeys.copied"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t("apikeys.h1")}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("apikeys.lead")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("apikeys.create")}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">…</div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("apikeys.empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">{t("apikeys.name")}</th>
                  <th className="text-left font-medium px-4 py-2">{t("apikeys.scopes")}</th>
                  <th className="text-left font-medium px-4 py-2">{t("apikeys.created")}</th>
                  <th className="text-left font-medium px-4 py-2">{t("apikeys.lastUsed")}</th>
                  <th className="text-left font-medium px-4 py-2">{t("apikeys.status")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const status = keyStatus(k);
                  return (
                    <tr key={k.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <div className="font-medium">{k.name}</div>
                        <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {k.scopes.join(", ")}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            status === "active"
                              ? "inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                              : "inline-flex rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs"
                          }
                        >
                          {t(`apikeys.${status}` as never)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => void onRevoke(k.id)}>
                            <Ban className="h-4 w-4" /> {t("apikeys.revoke")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => void onDelete(k.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <code>{t("apikeys.usage")}</code>
      </p>

      {/* Diálogo de creación */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apikeys.create")}</DialogTitle>
            <DialogDescription>{t("apikeys.lead")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("apikeys.name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("apikeys.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("apikeys.scopes")}</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={canRead} onCheckedChange={(v) => setCanRead(v === true)} />
                {t("apikeys.scope.read")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={canWrite} onCheckedChange={(v) => setCanWrite(v === true)} />
                {t("apikeys.scope.write")}
              </label>
            </div>
            <div className="space-y-2">
              <Label>{t("apikeys.expires")}</Label>
              <Input
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder={t("apikeys.never")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("settings.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
              {t("apikeys.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo con el secreto: se muestra una única vez */}
      <Dialog open={secret !== null} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apikeys.secretTitle")}</DialogTitle>
            <DialogDescription>{t("apikeys.secretHelp")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{secret}</code>
            <Button size="sm" variant="outline" onClick={() => secret && void copy(secret)}>
              <Copy className="h-4 w-4" /> {t("apikeys.copy")}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
