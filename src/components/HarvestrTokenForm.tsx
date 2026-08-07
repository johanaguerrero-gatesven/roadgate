import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import {
  deleteHarvestrToken,
  getHarvestrTokenStatus,
  saveHarvestrToken,
} from "@/lib/integrations.functions";
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Formulario seguro para guardar/actualizar el token privado de Harvestr.
 * El valor se envía una sola vez al servidor, se cifra allí y nunca se
 * devuelve al navegador: sólo se muestra una pista enmascarada.
 */
export function HarvestrTokenForm() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");

  const fetchStatus = useServerFn(getHarvestrTokenStatus);
  const saveToken = useServerFn(saveHarvestrToken);
  const removeToken = useServerFn(deleteHarvestrToken);

  const status = useQuery({
    queryKey: ["harvestr-token-status"],
    queryFn: () => fetchStatus({}),
  });

  const save = useMutation({
    mutationFn: (value: string) => saveToken({ data: { token: value } }),
    onSuccess: () => {
      setToken("");
      toast.success(t("harvestr.token.saved"));
      void queryClient.invalidateQueries({ queryKey: ["harvestr-token-status"] });
    },
    onError: (error: Error) => toast.error(`${t("harvestr.token.error")} ${error.message}`),
  });

  const remove = useMutation({
    mutationFn: () => removeToken({}),
    onSuccess: () => {
      toast.success(t("harvestr.token.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["harvestr-token-status"] });
    },
    onError: (error: Error) => toast.error(`${t("harvestr.token.error")} ${error.message}`),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = token.trim();
    if (value.length < 10) {
      toast.error(t("harvestr.token.tooShort"));
      return;
    }
    save.mutate(value);
  };

  const configured = status.data?.configured ?? false;
  const busy = save.isPending || remove.isPending;

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">{t("harvestr.token.h1")}</h3>
          <p className="text-sm text-muted-foreground">{t("harvestr.token.lead")}</p>
        </div>
      </div>

      {configured && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="inline-flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t("harvestr.token.configured")} <code className="text-xs">{status.data?.hint}</code>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => remove.mutate()}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("harvestr.token.delete")}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="harvestr-token">{t("harvestr.token.field")}</Label>
        <Input
          id="harvestr-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="hv_xxxxxxxxxxxxxxxx"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">{t("harvestr.token.help")}</p>
      </div>

      <Button type="submit" disabled={busy}>
        {save.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4 mr-2" />
        )}
        {configured ? t("harvestr.token.update") : t("harvestr.token.submit")}
      </Button>
    </form>
  );
}
