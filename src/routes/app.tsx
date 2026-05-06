import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { clearSession } from "@/lib/auth";
import { Map, Users, Gauge, Plus } from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Mi espacio — RoadGate" }],
  }),
  component: AppHome,
});

function AppHome() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  if (!ready || !session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Hola, <span className="text-foreground font-medium">{session.name}</span>
            </span>
            <Button variant="outline" onClick={() => { clearSession(); navigate({ to: "/" }); }}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tu espacio de roadmap</h1>
            <p className="text-muted-foreground mt-1">Próximamente podrás crear y gestionar tus roadmaps aquí.</p>
          </div>
          <Button size="lg" disabled>
            <Plus className="h-4 w-4" /> Nuevo roadmap
          </Button>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {[
            { icon: Map, title: "Roadmaps", value: "0", hint: "Crea tu primer roadmap" },
            { icon: Users, title: "Equipos", value: "0", hint: "Define quiénes ejecutan" },
            { icon: Gauge, title: "Capacidad disponible", value: "—", hint: "Configura FTEs por equipo" },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.title}</span>
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 text-3xl font-bold text-foreground">{c.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <Map className="h-10 w-10 mx-auto text-primary" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Aún no hay roadmaps</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            En la siguiente iteración podrás crear iniciativas, asignarlas a equipos y validar contra la capacidad real.
          </p>
        </div>
      </main>
    </div>
  );
}
