import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { AuthProviders } from "@/components/AuthProviders";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { login, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — RoadGate" },
      { name: "description", content: "Accede a tu cuenta de RoadGate." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    email: z.string().trim().email(t("validation.emailInvalid")).max(255),
    password: z.string().min(6, t("validation.passwordMin")).max(100),
  });

  useEffect(() => {
    if (getSession()) navigate({ to: "/app" });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      toast.success(t("login.success"));
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">{t("login.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      <AuthProviders />

      <Divider>{t("login.divider")}</Divider>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("login.password")}</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t("login.createOne")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 text-primary-foreground relative overflow-hidden"
        style={{ background: "var(--gradient-primary)" }}>
        <Logo tagline={false} variant="light" />
        <div>
          <p className="font-script text-3xl text-primary-foreground/90">
            {t("auth.shell.tagline")}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight max-w-md">
            {t("auth.shell.h2")}
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            {t("auth.shell.lead")}
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} GATES · RoadGate
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-between items-center">
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="ml-auto">
              <LanguageSwitcher variant="outline" />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-background px-2 text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}
