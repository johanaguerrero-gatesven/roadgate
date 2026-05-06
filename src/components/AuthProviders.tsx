import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { loginWithProvider } from "@/lib/auth";
import { toast } from "sonner";

export function AuthProviders({ providers = ["google", "microsoft"] }: { providers?: Array<"google" | "microsoft"> } = {}) {
  const navigate = useNavigate();

  const handle = (provider: "google" | "microsoft") => {
    // Placeholder until Lovable Cloud OAuth is enabled.
    toast.info(`${provider === "google" ? "Google" : "Microsoft"} SSO se habilitará al activar el backend. Entrando como demo…`);
    loginWithProvider(provider);
    navigate({ to: "/app" });
  };

  const cols = providers.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1";

  return (
    <div className={`grid grid-cols-1 ${cols} gap-3`}>
      {providers.includes("google") && (
        <Button type="button" variant="outline" onClick={() => handle("google")} className="h-11">
          <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.9 2 2.8 6.1 2.8 12S6.9 22 12 22c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"/>
          </svg>
          Continuar con Google
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
          Continuar con Microsoft
        </Button>
      )}
    </div>
  );
}
