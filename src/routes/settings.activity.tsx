/**
 * Settings → Activity (Fase 4)
 * Actividad administrativa del equipo: invitaciones, altas/bajas de miembros y
 * cambios de permisos o administración de roadmaps. Sólo Team Admin; el
 * backend y RLS son quienes lo garantizan (esta pantalla es solo la vista).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useActiveTeam } from "@/hooks/use-active-team";
import { listAuditEvents, type AuditEventView } from "@/lib/api/roadgate";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/activity")({
  component: ActivityPage,
});

const ACTION_KEY = {
  "invitation.sent": "activity.action.invitationSent",
  "invitation.accepted": "activity.action.invitationAccepted",
  "member.status_changed": "activity.action.memberStatus",
  "roadmap.role_changed": "activity.action.roadmapRole",
  "roadmap.access_revoked": "activity.action.roadmapRevoked",
  "roadmap.admin_transferred": "activity.action.roadmapTransferred",
} as const satisfies Record<AuditEventView["action"], string>;

function ActivityPage() {
  const { t } = useI18n();
  const { team, isTeamAdmin } = useActiveTeam();
  const [events, setEvents] = useState<AuditEventView[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!team || !isTeamAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEvents(await listAuditEvents({ limit: 200 }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [team, isTeamAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isTeamAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {t("users.onlyAdmin")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("activity.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("activity.help")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> {t("activity.refresh")}
        </Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("users.loading")}</p>
      ) : events.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("activity.empty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t(ACTION_KEY[e.action])}</Badge>
                  {e.targetEmail && (
                    <span className="text-sm truncate">{e.targetEmail}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("activity.by")}: {e.actorEmail ?? e.actorUserId}
                  {e.roadmapId ? ` · ${t("activity.roadmap")}: ${e.roadmapId.slice(0, 8)}…` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(e.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
