/**
 * Aceptación de invitaciones de equipo (Fase II).
 * Ruta pública: si no hay sesión se envía a /login conservando el token, y al
 * volver se acepta contra la API (operación idempotente y validada en backend).
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { acceptTeamInvitation } from "@/lib/api/roadgate";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({
    meta: [
      { title: "Accept team invitation — RoadGate" },
      {
        name: "description",
        content: "Accept your RoadGate team invitation and start planning with your team.",
      },
      { property: "og:title", content: "Accept team invitation — RoadGate" },
      {
        property: "og:description",
        content: "Accept your RoadGate team invitation and start planning with your team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "working" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setState("error");
      setMessage(t("invite.missingToken"));
      return;
    }
    if (!session) return;
    if (state !== "idle") return;

    setState("working");
    acceptTeamInvitation({ token })
      .then(() => setState("ok"))
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Error");
      });
  }, [ready, session, token, state, t]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] space-y-4 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="text-xl font-semibold">{t("invite.title")}</h1>

        {!ready && <p className="text-sm text-muted-foreground">{t("invite.accepting")}</p>}

        {ready && !session && (
          <>
            <p className="text-sm text-muted-foreground">{t("invite.needLogin")}</p>
            <Button onClick={() => navigate({ to: "/login" })}>{t("nav.signIn")}</Button>
          </>
        )}

        {ready && session && state === "working" && (
          <p className="text-sm text-muted-foreground">{t("invite.accepting")}</p>
        )}

        {state === "ok" && (
          <>
            <p className="text-sm text-foreground">{t("invite.success")}</p>
            <Button onClick={() => navigate({ to: "/app" })}>{t("invite.goApp")}</Button>
          </>
        )}

        {state === "error" && <p className="text-sm text-destructive">{message}</p>}
      </div>
    </div>
  );
}
