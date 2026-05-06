import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/use-auth";
import { clearSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function SiteHeader() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">{t("nav.home")}</Link>
          <a href="/#features" className="hover:text-foreground transition-colors">{t("nav.product")}</a>
          <a href="/#why" className="hover:text-foreground transition-colors">{t("nav.why")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {ready && session ? (
            <>
              <Button variant="ghost" onClick={() => navigate({ to: "/app" })}>
                {t("nav.goApp")}
              </Button>
              <Button variant="outline" onClick={() => { clearSession(); navigate({ to: "/" }); }}>
                {t("nav.signOut")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate({ to: "/login" })}>
                {t("nav.signIn")}
              </Button>
              <Button onClick={() => navigate({ to: "/register" })}>
                {t("nav.signUp")}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
