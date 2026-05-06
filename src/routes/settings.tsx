import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { clearSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { User, Users as UsersIcon, Building2, Plug, CreditCard, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — RoadGate" }] }),
  component: SettingsLayout,
});

function SettingsLayout() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  useEffect(() => {
    if (pathname === "/settings") navigate({ to: "/settings/profile", replace: true });
  }, [pathname, navigate]);

  if (!ready || !session) return null;

  const items = [
    { to: "/settings/profile", label: t("settings.section.profile"), icon: User },
    { to: "/settings/users", label: t("settings.section.users"), icon: UsersIcon },
    { to: "/settings/company", label: t("settings.section.company"), icon: Building2 },
    { to: "/settings/integrations", label: t("settings.section.integrations"), icon: Plug },
    { to: "/settings/billing", label: t("settings.section.billing"), icon: CreditCard },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
              <ArrowLeft className="h-4 w-4" /> {t("nav.goApp")}
            </Button>
            <LanguageSwitcher />
            <Button variant="outline" onClick={() => { clearSession(); navigate({ to: "/" }); }}>
              {t("nav.signOut")}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">{t("settings.title")}</h1>
        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          <aside>
            <nav className="flex md:flex-col gap-1 overflow-x-auto">
              {items.map((it) => {
                const active = pathname.startsWith(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <it.icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
