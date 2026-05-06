import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArrowRight, Calendar, Gauge, Users, Map, Sparkles, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t } = useI18n();
  const features = [
    { icon: Map, title: t("home.features.f1.title"), desc: t("home.features.f1.desc") },
    { icon: Users, title: t("home.features.f2.title"), desc: t("home.features.f2.desc") },
    { icon: Calendar, title: t("home.features.f3.title"), desc: t("home.features.f3.desc") },
  ];
  const rows = [
    { name: t("home.card.row1"), color: "bg-primary", w: "w-3/4" },
    { name: t("home.card.row2"), color: "bg-[oklch(0.70_0.13_70)]", w: "w-1/2" },
    { name: t("home.card.row3"), color: "bg-[oklch(0.60_0.14_265)]", w: "w-2/3" },
    { name: t("home.card.row4"), color: "bg-[oklch(0.65_0.16_25)]", w: "w-1/3" },
  ];
  const stats = [
    { k: "+30%", v: t("home.why.s1") },
    { k: "−40%", v: t("home.why.s2") },
    { k: t("home.why.s3.k"), v: t("home.why.s3") },
    { k: t("home.why.s4.k"), v: t("home.why.s4") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-foreground) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.badge")}
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              {t("home.h1.a")} <span className="font-script text-primary text-5xl md:text-7xl">{t("home.h1.script")}</span> {t("home.h1.b")}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              {t("home.lead")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base shadow-[var(--shadow-elegant)]">
                <Link to="/register">
                  {t("home.cta.primary")} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link to="/login">{t("home.cta.secondary")}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {t("home.cta.fineprint")}
            </p>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div className="rounded-2xl bg-card border border-border shadow-[var(--shadow-elegant)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Map className="h-4 w-4 text-primary" /> {t("home.card.title")}
                </div>
                <span className="text-xs text-muted-foreground">{t("home.card.capacity")}</span>
              </div>
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground font-medium">{row.name}</span>
                      <span className="text-muted-foreground">{t("home.card.sprint")}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`${row.color} ${row.w} h-full rounded-full`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("home.card.team")}</span>
                <span className="text-primary font-medium">{t("home.card.realistic")}</span>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 hidden md:block rounded-xl bg-card border border-border shadow-[var(--shadow-soft)] p-3 text-xs">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{t("home.card.balanced")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {t("home.features.h2")}
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              {t("home.features.lead")}
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elegant)] transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="py-20 md:py-24 bg-secondary/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="font-script text-primary text-3xl">{t("home.why.kicker")}</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {t("home.why.h2")}
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("home.why.lead")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.v} className="rounded-xl border border-border bg-card p-5">
                <div className="text-2xl font-bold text-primary">{s.k}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-[var(--gradient-primary)] text-primary-foreground p-10 md:p-14 text-center shadow-[var(--shadow-elegant)]">
            <ShieldCheck className="h-10 w-10 mx-auto opacity-90" />
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              {t("home.cta2.h2")}
            </h2>
            <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
              {t("home.cta2.lead")}
            </p>
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
                <Link to="/register">{t("home.cta2.primary")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/login">{t("home.cta2.secondary")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
