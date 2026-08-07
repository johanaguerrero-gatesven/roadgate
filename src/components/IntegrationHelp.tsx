import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useI18n } from "@/lib/i18n";
import { HelpCircle, KeyRound, PlugZap, Rocket, ShieldCheck, AlertTriangle } from "lucide-react";

const SECTIONS = [
  { id: "save", icon: KeyRound, titleKey: "help.harvestr.save.title", steps: ["help.harvestr.save.s1", "help.harvestr.save.s2", "help.harvestr.save.s3", "help.harvestr.save.s4"], tipKey: "help.harvestr.save.tip" },
  { id: "test", icon: PlugZap, titleKey: "help.harvestr.test.title", steps: ["help.harvestr.test.s1", "help.harvestr.test.s2", "help.harvestr.test.s3"], tipKey: "help.harvestr.test.tip" },
  { id: "create", icon: Rocket, titleKey: "help.harvestr.create.title", steps: ["help.harvestr.create.s1", "help.harvestr.create.s2", "help.harvestr.create.s3", "help.harvestr.create.s4"], tipKey: "help.harvestr.create.tip" },
  { id: "trouble", icon: AlertTriangle, titleKey: "help.harvestr.trouble.title", steps: ["help.harvestr.trouble.s1", "help.harvestr.trouble.s2", "help.harvestr.trouble.s3"], tipKey: "help.harvestr.trouble.tip" },
  { id: "security", icon: ShieldCheck, titleKey: "help.harvestr.security.title", steps: ["help.harvestr.security.s1", "help.harvestr.security.s2", "help.harvestr.security.s3"], tipKey: "help.harvestr.security.tip" },
] as const;

export function IntegrationHelp() {
  const { t } = useI18n();

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">{t("help.harvestr.h1")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t("help.harvestr.lead")}</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="mt-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <AccordionItem key={s.id} value={s.id}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <span className="flex items-center gap-2 text-left">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  {t(s.titleKey as any)}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
                  {s.steps.map((k) => (
                    <li key={k}>{t(k as any)}</li>
                  ))}
                </ol>
                <p className="mt-3 rounded-md border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs text-foreground/80">
                  {t(s.tipKey as any)}
                </p>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
