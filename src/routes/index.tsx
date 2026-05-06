import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArrowRight, Calendar, Gauge, Users, Map, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
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
              Una iniciativa de GATES
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              El roadmap que <span className="font-script text-primary text-5xl md:text-7xl">respeta</span> la capacidad real de tu equipo.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              RoadGate combina la planificación visual de un roadmap moderno con la realidad operativa de tu equipo: disponibilidad, foco y compromisos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base shadow-[var(--shadow-elegant)]">
                <Link to="/register">
                  Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link to="/login">Ya tengo una cuenta</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sin tarjeta de crédito · Acceso inmediato
            </p>
          </div>

          {/* Hero visual: stylized roadmap */}
          <div className="relative">
            <div className="rounded-2xl bg-card border border-border shadow-[var(--shadow-elegant)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Map className="h-4 w-4 text-primary" /> Roadmap Q3 — Producto Atlas
                </div>
                <span className="text-xs text-muted-foreground">Capacidad: 78%</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Onboarding rediseñado", color: "bg-primary", w: "w-3/4" },
                  { name: "API pública v2", color: "bg-[oklch(0.70_0.13_70)]", w: "w-1/2" },
                  { name: "Panel de métricas", color: "bg-[oklch(0.60_0.14_265)]", w: "w-2/3" },
                  { name: "Integraciones SSO", color: "bg-[oklch(0.65_0.16_25)]", w: "w-1/3" },
                ].map((row) => (
                  <div key={row.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground font-medium">{row.name}</span>
                      <span className="text-muted-foreground">Sprint 4–6</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`${row.color} ${row.w} h-full rounded-full`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Equipo: 6 personas · 4.2 FTE disponibles</span>
                <span className="text-primary font-medium">Realista ✓</span>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 hidden md:block rounded-xl bg-card border border-border shadow-[var(--shadow-soft)] p-3 text-xs">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Capacidad balanceada</span>
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
              Planifica como un Product Manager. Entrega como un equipo real.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Inspirado en las mejores prácticas de roadmapping, con una diferencia clave: cada iniciativa se contrasta contra la capacidad real de tu equipo.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Map,
                title: "Roadmap visual",
                desc: "Vista timeline y swimlane para comunicar prioridades a stakeholders sin ambigüedad.",
              },
              {
                icon: Users,
                title: "Capacidad por equipo",
                desc: "Define FTEs, foco y disponibilidad. RoadGate avisa cuando comprometes más de lo posible.",
              },
              {
                icon: Calendar,
                title: "Iteraciones realistas",
                desc: "Convierte iniciativas en sprints u OKRs trimestrales sin perder la visión global.",
              },
            ].map((f) => (
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
            <span className="font-script text-primary text-3xl">¿Por qué RoadGate?</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Porque un roadmap sin capacidad es solo una lista de deseos.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Con la experiencia de GATES integrando equipos tech Senior en LATAM, sabemos que entregar a tiempo no es un tema de optimismo: es un tema de visibilidad sobre la capacidad real.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { k: "+30%", v: "predictibilidad de entrega" },
              { k: "−40%", v: "compromisos por encima de capacidad" },
              { k: "1 vista", v: "para producto, ingeniería y dirección" },
              { k: "Real-time", v: "ajuste de roadmap por capacidad" },
            ].map((s) => (
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
              Empieza a planificar con la realidad de tu equipo
            </h2>
            <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
              Crea tu cuenta y arma tu primer roadmap en minutos.
            </p>
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
                <Link to="/register">Crear cuenta</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
