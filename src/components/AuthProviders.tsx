import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { loginWithProvider } from "@/lib/auth";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function AuthProviders({ providers = ["google", "microsoft"] }: { providers?: Array<"google" | "microsoft"> } = {}) {
  const navigate = useNavigate();
  const { t } = useI18n();

  const handle = (provider: "google" | "microsoft") => {
    toast.info(`${provider === "google" ? "Google" : "Microsoft"} — ${t("auth.providers.toast")}`);
    loginWithProvider(provider);
    navigate({ to: "/app" });
  };

  const cols = providers.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1";

  return (
    <div className={`grid grid-cols-1 ${cols} gap-3`}>
      {providers.includes("google") && (
        <Button type="button" variant="outline" onClick={() => handle("google")} className="h-11">
          <svg viewBox="0 0 48 48" className="h-4 w-4 mr-2" aria-hidden>
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          {t("auth.providers.google")}
        </Button>
      )}
      {providers.includes("microsoft") && (
        <Button type="button" variant="outline" onClick={() => handle("microsoft")} className="h-11">
          <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden>
            <rect width="10" height="10" x="2" y="2" fill="#F25022"/>
            <rect width="10" height="10" x="12" y="2" fill="#7FBA00"/>
            <rect width="10" height="10" x="2" y="12" fill="#00A4EF"/>
            <rect width="10" height="10" x="12" y="12" fill="#FFB900"/>
          </svg>
          {t("auth.providers.microsoft")}
        </Button>
      )}
    </div>
  );
}
