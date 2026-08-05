import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground max-w-md">
            {t("footer.tagline")} <span className="text-foreground font-medium">GATES</span>.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Link to="/docs/api" className="text-xs text-muted-foreground hover:text-foreground">
            {t("footer.apidocs")}
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GATES. {t("footer.rights")}
          </p>
        </div>

      </div>
    </footer>
  );
}
