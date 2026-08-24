import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthProviders } from "@/components/AuthProviders";
import { signUpWithEmail } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { AuthShell } from "./login";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — RoadGate" },
      { name: "description", content: "Crea tu cuenta de RoadGate y empieza a planificar tu roadmap." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(2, t("validation.nameMin")).max(80),
    email: z.string().trim().email(t("validation.emailInvalid")).max(255),
    password: z.string().min(6, t("validation.passwordMin")).max(100),
  });

  useEffect(() => {
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/app", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await register(parsed.data.name, parsed.data.email, parsed.data.password);
      toast.success(t("register.success"));
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("register.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">{t("register.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("register.subtitle")}</p>
      </div>

      <AuthProviders providers={["google"]} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-background px-2 text-muted-foreground">{t("register.divider")}</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("register.name")}</Label>
          <Input id="name" autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} placeholder={t("register.namePh")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("login.password")}</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder={t("register.passwordPh")} required />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? t("register.submitting") : t("register.submit")}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {t("register.terms")}
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t("register.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
