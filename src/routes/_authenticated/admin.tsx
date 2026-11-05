import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, ShieldCheck, Users, Map } from "lucide-react";
import { adminRegistrationsOptions } from "@/lib/admin-queries";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: z.object({ page: z.coerce.number().int().min(0).max(100000).catch(0) }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(adminRegistrationsOptions(deps.page, context.userId)),
  head: () => ({ meta: [
    { title: "Admin — RoadGate registrations" },
    { name: "description", content: "Restricted RoadGate registration and roadmap creation statistics." },
    { property: "og:title", content: "Admin — RoadGate registrations" },
    { property: "og:description", content: "Restricted RoadGate registration and roadmap creation statistics." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: AdminDenied,
  component: AdminPage,
});

function AdminDenied() {
  const { t } = useI18n();
  return <div className="min-h-screen bg-background text-foreground p-8"><h1 className="text-2xl font-bold">{t("admin.title")}</h1><p role="alert" className="my-6">{t("admin.unavailable")}</p><Button asChild variant="outline"><Link to="/app"><ArrowLeft />{t("nav.goApp")}</Link></Button></div>;
}

function AdminPage() {
  const { page } = Route.useSearch();
  const { userId } = Route.useRouteContext();
  const { data, refetch, isFetching } = useSuspenseQuery(adminRegistrationsOptions(page, userId));
  const { t, locale } = useI18n();
  const totalUsers = Number(data[0]?.total_users ?? 0);
  const totalRoadmaps = Number(data[0]?.total_roadmaps ?? 0);
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString(locale === "es" ? "es-ES" : "en-US") : "—";
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card"><div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3"><Logo tagline={false} /><div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm"><Link to="/app"><ArrowLeft />{t("nav.goApp")}</Link></Button><LanguageSwitcher /></div></div></header>
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="flex items-center gap-3 text-2xl font-bold"><ShieldCheck className="text-primary" />{t("admin.title")}</h1><Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}><RefreshCw />{t("activity.refresh")}</Button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-8 border-y border-border py-6">
        <div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />{t("admin.registered")}</p><p className="text-3xl font-bold mt-2">{totalUsers}</p></div>
        <div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Map className="h-4 w-4" />{t("admin.roadmaps")}</p><p className="text-3xl font-bold mt-2">{totalRoadmaps}</p></div>
      </div>
      <h2 className="text-lg font-semibold mb-4">{t("admin.registered")}</h2>
      <Table><TableHeader><TableRow><TableHead>{t("admin.email")}</TableHead><TableHead className="whitespace-nowrap">{t("admin.date")}</TableHead><TableHead className="whitespace-nowrap">{t("admin.lastSignIn")}</TableHead><TableHead className="text-right whitespace-nowrap">{t("admin.roadmaps")}</TableHead></TableRow></TableHeader><TableBody>
        {data.map(user => <TableRow key={user.user_id}><TableCell className="min-w-48 break-all">{user.email ?? "—"}</TableCell><TableCell className="whitespace-nowrap">{formatDate(user.registered_at)}</TableCell><TableCell className="whitespace-nowrap">{formatDate(user.last_sign_in_at)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{Number(user.roadmap_count)}</TableCell></TableRow>)}
        {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("admin.empty")}</TableCell></TableRow>}
      </Table>
      <div className="mt-6 flex justify-end items-center gap-3"><Button asChild variant="outline" size="icon" disabled={page === 0}><Link to="/admin" search={{ page: Math.max(0, page - 1) }} aria-label={t("admin.previous")} aria-disabled={page === 0} tabIndex={page === 0 ? -1 : 0} className={page === 0 ? "pointer-events-none opacity-50" : ""}><ChevronLeft /></Link></Button><span className="text-sm text-muted-foreground">{t("admin.page")} {page + 1}</span><Button asChild variant="outline" size="icon" disabled={(page + 1) * 50 >= totalUsers}><Link to="/admin" search={{ page: page + 1 }} aria-label={t("admin.next")} aria-disabled={(page + 1) * 50 >= totalUsers} tabIndex={(page + 1) * 50 >= totalUsers ? -1 : 0} className={(page + 1) * 50 >= totalUsers ? "pointer-events-none opacity-50" : ""}><ChevronRight /></Link></Button></div>
    </main>
  </div>;
}