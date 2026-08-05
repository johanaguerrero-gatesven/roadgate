import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { clearSession } from "@/lib/auth";
import { Map, Users, ListChecks, Plus, User, Settings, LogOut, CalendarDays, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getWorkspaceStats, listRoadmaps } from "@/lib/api/roadgate";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Mi espacio — RoadGate" }],
  }),
  component: AppHome,
});

type Stats = {
  roadmapsCount: number;
  teamsCount: number;
  totalDevelopers: number;
  totalItems: number;
  byType: { epic: number; feature: number; story: number };
};
type RoadmapSummary = { id: string; name: string; createdAt: string; updatedAt: string; itemCount: number };

const EMPTY_STATS: Stats = {
  roadmapsCount: 0, teamsCount: 0, totalDevelopers: 0, totalItems: 0,
  byType: { epic: 0, feature: 0, story: 0 },
};

function AppHome() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[] | null>(null);
  const [scope, setScope] = useState<string>("all");

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  useEffect(() => {
    if (!session?.userId) { setRoadmaps(null); return; }
    listRoadmaps()
      .then((rows) => {
        const list = rows as RoadmapSummary[];
        setRoadmaps(list);
        // El desglose de ítems siempre se muestra por roadmap: se preselecciona
        // el más reciente en lugar de un total global mezclado.
        setScope((s) => (s === "all" && list.length > 0 ? list[0]!.id : s));
      })
      .catch((e) => { console.error(e); setRoadmaps([]); });
  }, [session?.userId]);

  // Los KPIs del roadmap se recalculan cada vez que cambia la selección.
  useEffect(() => {
    if (!session?.userId) { setStats(null); return; }
    setStats(null);
    getWorkspaceStats({ roadmapId: scope === "all" ? null : scope })
      .then((s) => setStats(s as Stats))
      .catch((e) => { console.error(e); setStats(EMPTY_STATS); });
  }, [session?.userId, scope]);

  if (!ready || !session) return null;

  const recent = roadmaps === null ? null : roadmaps.slice(0, 5);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const scopeName = scope === "all" ? t("app.stats.scope.all") : roadmaps?.find((r) => r.id === scope)?.name ?? "—";
  const breakdown = [
    { key: "epic", label: t("roadmap.dash.epics"), value: stats?.byType.epic },
    { key: "feature", label: t("roadmap.dash.features"), value: stats?.byType.feature },
    { key: "story", label: t("roadmap.dash.stories"), value: stats?.byType.story },
  ];



  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {t("app.greeting")} <span className="text-foreground font-medium">{session.name}</span>
            </span>
            <LanguageSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold hover:opacity-90">
                  {(session.name || session.email).charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{session.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{session.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings/profile"><User className="h-4 w-4" /> {t("nav.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/company"><Settings className="h-4 w-4" /> {t("nav.settings")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { clearSession(); navigate({ to: "/" }); }}>
                  <LogOut className="h-4 w-4" /> {t("nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("app.h1")}</h1>
            <p className="text-muted-foreground mt-1">{t("app.lead")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="lg" variant="outline" asChild>
              <Link to="/roadmaps">{t("app.myRoadmaps")}</Link>
            </Button>

            <Button size="lg" asChild>
              <Link to="/roadmaps/new"><Plus className="h-4 w-4" /> {t("app.new")}</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {/* Tarjeta 1 — resumen del espacio */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground">{t("app.stats.roadmaps")}</span>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Map className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-primary">
              {stats ? stats.roadmapsCount : "…"}
            </div>
            {/* Mini timeline decorativa: representa los 4 quarters del roadmap */}
            <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
              {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
                <div key={q} className="flex-1">
                  <div
                    className="h-1.5 rounded-full bg-primary/70"
                    style={{ opacity: 1 - i * 0.2 }}
                  />
                  <div className="mt-1.5 text-[10px] font-medium tracking-wide text-muted-foreground">{q}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tarjeta 2 — métricas del roadmap seleccionado */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted-foreground">{t("app.stats.items")}</span>
                <div className="mt-1 truncate text-xs text-muted-foreground/80">{scopeName}</div>
              </div>
              <div className="flex items-center gap-2">
                {roadmaps && roadmaps.length > 0 && (
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger className="h-9 w-[220px] rounded-lg border-border/70 bg-background text-sm">
                      <SelectValue placeholder={t("app.stats.scope")} />
                    </SelectTrigger>
                    <SelectContent>
                      {roadmaps.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <ListChecks className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <div className="text-4xl font-semibold tracking-tight text-primary">
                {stats ? stats.totalItems : "…"}
              </div>
              <div className="pb-1.5 text-xs text-muted-foreground">{t("app.stats.items.hint")}</div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
              {breakdown.map((b) => (
                <div key={b.key}>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.label}</div>
                  <div className="mt-1 text-xl font-semibold text-foreground">
                    {stats ? b.value : "…"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>


        {(roadmaps?.length ?? 0) > 0 ? (

          <div className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("app.recent.h2")}</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/roadmaps">{t("app.recent.viewAll")} <ChevronRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="mt-4 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              {recent === null ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse bg-muted/40" />
                ))
              ) : (
                recent.map((r) => (
                  <Link
                    key={r.id}
                    to="/roadmaps/$roadmapId"
                    params={{ roadmapId: r.id }}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {r.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {t("app.recent.updated")} {formatDate(r.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <span className="hidden shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground sm:inline">
                      {r.itemCount} {t("app.recent.items")}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))
              )}
            </div>
          </div>

        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
            <Map className="h-10 w-10 mx-auto text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">{t("app.empty.h2")}</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              {t("app.empty.lead")}
            </p>
            <div className="mt-6">
              <Button size="lg" asChild>
                <Link to="/roadmaps/new"><Plus className="h-4 w-4" /> {t("app.empty.create")}</Link>
              </Button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
