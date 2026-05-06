import { Button } from "@/components/ui/button";
import { useI18n, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { locale, setLocale, t } = useI18n();

  const select = (l: Locale) => setLocale(l);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" aria-label={t("lang.label")} className="gap-1.5">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => select("es")} aria-current={locale === "es"}>
          🇪🇸 {t("lang.es")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => select("en")} aria-current={locale === "en"}>
          🇬🇧 {t("lang.en")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
