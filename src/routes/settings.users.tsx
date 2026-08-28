/**
 * Settings → Users (Fase II)
 * Gestión real de miembros del equipo contra la API (`/teams/*`). Nada de
 * localStorage: el estado, los roles y los permisos vienen del backend y están
 * reforzados por RLS.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { useActiveTeam } from "@/hooks/use-active-team";
import {
  listTeamMembers,
  listTeamInvitations,
  inviteTeamMember,
  resendTeamInvitation,
  revokeTeamInvitation,
  setTeamMemberStatus,
  type TeamMemberView,
  type TeamInvitationView,
} from "@/lib/api/roadgate";
import { Copy, Mail, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/users")({
  component: UsersPage,
});

function UsersPage() {
  const { t } = useI18n();
  const { team, isTeamAdmin } = useActiveTeam();
  const [members, setMembers] = useState<TeamMemberView[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const [m, inv] = await Promise.all([
        listTeamMembers(),
        team.role === "admin" ? listTeamInvitations() : Promise.resolve<TeamInvitationView[]>([]),
      ]);
      setMembers(m);
      setInvitations(inv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pending = invitations.filter((i) => i.status === "pending" || i.status === "expired");
  const active = members.filter((m) => m.status === "active");
  const inactive = members.filter((m) => m.status === "inactive");

  const run = async (fn: () => Promise<unknown>, okMessage?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) toast.success(okMessage);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await inviteTeamMember({ email: email.trim() });
      setEmail("");
      setInviteUrl(result.emailSent ? null : result.inviteUrl);
      toast.success(t("users.invite.sent"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success(t("users.invite.copied"));
  };

  return (
    <div className="space-y-6">
      {isTeamAdmin ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold">{t("users.invite.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("users.invite.help")}</p>
          <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <Input
                type="email"
                placeholder={t("users.invitePh.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={invite} disabled={busy || !email.trim()}>
              <Plus className="h-4 w-4" /> {t("users.invite.send")}
            </Button>
          </div>

          {inviteUrl && (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <div className="text-sm font-medium">{t("users.invite.linkTitle")}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("users.invite.linkHelp")}</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => copy(inviteUrl)}>
                  <Copy className="h-4 w-4" /> {t("users.invite.copy")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("users.onlyAdmin")}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("users.loading")}</p>
        ) : (
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="pending">
                {t("users.tab.pending")} ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                {t("users.tab.active")} ({active.length})
              </TabsTrigger>
              <TabsTrigger value="inactive">
                {t("users.tab.inactiveNew")} ({inactive.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pending.length === 0 ? (
                <Empty label={t("users.empty")} />
              ) : (
                <ul className="divide-y divide-border">
                  {pending.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {inv.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("users.expires")}: {new Date(inv.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={inv.status === "expired" ? "destructive" : "secondary"}>
                          {inv.status === "expired"
                            ? t("users.status.expired")
                            : t("users.status.pending")}
                        </Badge>
                        {isTeamAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const r = await resendTeamInvitation({ invitationId: inv.id });
                                  setInviteUrl(r.emailSent ? null : r.inviteUrl);
                                }, t("users.invite.sent"))
                              }
                            >
                              <RefreshCw className="h-4 w-4" /> {t("users.resend")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => revokeTeamInvitation({ invitationId: inv.id }),
                                  t("users.revoked"),
                                )
                              }
                            >
                              <X className="h-4 w-4" /> {t("users.revoke")}
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="active">
              <MemberList
                members={active}
                empty={t("users.empty")}
                render={(m) =>
                  isTeamAdmin && m.role !== "admin" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => setTeamMemberStatus({ memberId: m.id, status: "inactive" }),
                          t("users.deactivated"),
                        )
                      }
                    >
                      {t("users.deactivate")}
                    </Button>
                  ) : null
                }
                t={t}
              />
            </TabsContent>

            <TabsContent value="inactive">
              <MemberList
                members={inactive}
                empty={t("users.empty")}
                render={(m) =>
                  isTeamAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => setTeamMemberStatus({ memberId: m.id, status: "active" }),
                          t("users.activated"),
                        )
                      }
                    >
                      {t("users.activate")}
                    </Button>
                  ) : null
                }
                t={t}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}

function MemberList({
  members,
  empty,
  render,
  t,
}: {
  members: TeamMemberView[];
  empty: string;
  render: (m: TeamMemberView) => React.ReactNode;
  t: (key: string) => string;
}) {
  if (members.length === 0) return <Empty label={empty} />;
  return (
    <ul className="divide-y divide-border">
      {members.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{m.email ?? m.userId}</div>
            <div className="text-xs text-muted-foreground">
              {m.role === "admin" ? t("users.role.admin") : t("users.role.member")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={m.role === "admin" ? "default" : "secondary"}>
              {m.role === "admin" ? t("users.role.admin") : t("users.role.member")}
            </Badge>
            {render(m)}
          </div>
        </li>
      ))}
    </ul>
  );
}
