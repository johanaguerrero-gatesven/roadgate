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
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} GATES. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
