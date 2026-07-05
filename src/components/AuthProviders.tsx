import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

type Provider = "google" | "microsoft";

export function AuthProviders({ providers = ["google", "microsoft"] }: { providers?: Provider[] } = {}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Provider | null>(null);

  const handle = async (provider: Provider) => {
    if (provider === "microsoft") {
      toast.info("Microsoft sign-in is not enabled yet.");
      return;
    }
    setLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return; // browser navigates away
      // Popup flow (editor preview): confirm session then go to /app
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success("Signed in with Google");
        navigate({ to: "/app" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {providers.includes("google") && (
        <Button
          type="button"
          variant="outline"
          disabled={loading === "google"}
          onClick={() => handle("google")}
          className="relative h-11 w-full justify-center rounded-md border-border/70 bg-card font-medium text-foreground/90 shadow-sm transition-all hover:-translate-y-px hover:bg-accent/40 hover:shadow-md"
        >
          <GoogleIcon className="absolute left-4 h-[18px] w-[18px]" />
          <span className="truncate">{loading === "google" ? "Connecting…" : t("auth.providers.google")}</span>
        </Button>
      )}
      {providers.includes("microsoft") && (
        <Button
          type="button"
          variant="outline"
          onClick={() => handle("microsoft")}
          className="relative h-11 w-full justify-center rounded-md border-border/70 bg-card font-medium text-foreground/90 shadow-sm transition-all hover:-translate-y-px hover:bg-accent/40 hover:shadow-md"
        >
          <MicrosoftIcon className="absolute left-4 h-[18px] w-[18px]" />
          <span className="truncate">{t("auth.providers.microsoft")}</span>
        </Button>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect width="10" height="10" x="1" y="1" fill="#F25022"/>
      <rect width="10" height="10" x="13" y="1" fill="#7FBA00"/>
      <rect width="10" height="10" x="1" y="13" fill="#00A4EF"/>
      <rect width="10" height="10" x="13" y="13" fill="#FFB900"/>
    </svg>
  );
}
