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
import { Map, Users, ListChecks, Plus, User, Settings, LogOut, CalendarDays } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspaceStats, listRoadmaps } from "@/lib/roadmap.functions";

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


function AppHome() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const statsFn = useServerFn(getWorkspaceStats);
  const listFn = useServerFn(listRoadmaps);
  const [stats, setStats] = useState<Stats | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[] | null>(null);
  const [scope, setScope] = useState<string>("all");

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  useEffect(() => {
    if (!session?.userId) { setRoadmaps(null); return; }
    listFn()
      .then((rows) => setRoadmaps(rows as RoadmapSummary[]))
      .catch((e) => { console.error(e); setRoadmaps([]); });
  }, [session?.userId, listFn]);

  // Los KPIs se recalculan cada vez que cambia el roadmap seleccionado, de modo
  // que "Items totales" refleja únicamente el roadmap activo (o todos si scope=all).
  useEffect(() => {
    if (!session?.userId) { setStats(null); return; }
    setStats(null);
    statsFn({ data: { roadmapId: scope === "all" ? null : scope } })
      .then((s) => setStats(s as Stats))
      .catch((e) => { console.error(e); setStats({ roadmapsCount: 0, teamsCount: 0, totalDevelopers: 0, totalItems: 0 }); });
  }, [session?.userId, statsFn, scope]);

  if (!ready || !session) return null;

  const recent = roadmaps === null ? null : roadmaps.slice(0, 5);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const scopeName = scope === "all" ? null : roadmaps?.find((r) => r.id === scope)?.name ?? null;

  const cards = [
    {
      icon: Map,
      title: t("app.stats.roadmaps"),
      value: stats ? String(stats.roadmapsCount) : "…",
      hint: t("app.stats.roadmaps.hint"),
    },
    // Teams card hidden — no functionality wired up yet. Re-enable when team features are added.
    // {
    //   icon: Users,
    //   title: t("app.stats.teams"),
    //   value: stats ? String(stats.teamsCount) : "…",
    //   hint: t("app.stats.teams.hint"),
    // },
    {
      icon: ListChecks,
      title: t("app.stats.items"),
      value: stats ? String(stats.totalItems) : "…",
      hint: scopeName ?? t("app.stats.items.hint"),
    },
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

        {roadmaps && roadmaps.length > 0 && (
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">{t("app.stats.scope")}</span>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("app.stats.scope.all")}</SelectItem>
                {roadmaps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mt-6 grid md:grid-cols-2 gap-5">
          {cards.map((c) => (
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

        {(roadmaps?.length ?? 0) > 0 ? (

          <div className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">{t("app.recent.h2")}</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/roadmaps">{t("app.recent.viewAll")}</Link>
              </Button>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent === null ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-xl border border-border bg-card/60 animate-pulse" />
                ))
              ) : (
                recent.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {t("app.recent.updated")} {formatDate(r.updatedAt)}
                          </span>
                          <span>{r.itemCount} {t("app.recent.items")}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/roadmaps/$roadmapId" params={{ roadmapId: r.id }}>
                          {t("app.recent.open")}
                        </Link>
                      </Button>
                    </div>
                  </div>
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
