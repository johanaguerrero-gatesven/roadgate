import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { getTeam, saveTeam, type TeamMember, type TeamRole } from "@/lib/profile";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/users")({
  component: UsersPage,
});

function UsersPage() {
  const { t } = useI18n();
  const [team, setTeam] = useState<TeamMember[]>(() => getTeam());
  const [draft, setDraft] = useState({ name: "", email: "", role: "collaborator" as TeamRole });

  const persist = (next: TeamMember[]) => {
    setTeam(next);
    saveTeam(next);
  };

  const invite = () => {
    if (!draft.email.trim()) return;
    const next: TeamMember[] = [
      ...team,
      {
        id: crypto.randomUUID(),
        name: draft.name.trim() || draft.email.split("@")[0],
        email: draft.email.trim().toLowerCase(),
        role: draft.role,
        invitedAt: new Date().toISOString(),
      },
    ];
    persist(next);
    setDraft({ name: "", email: "", role: "collaborator" });
    toast.success(t("settings.saved"));
  };

  const setRole = (id: string, role: TeamRole) =>
    persist(team.map((m) => (m.id === id ? { ...m, role } : m)));
  const remove = (id: string) => persist(team.filter((m) => m.id !== id));

  const list = (role: TeamRole) => team.filter((m) => m.role === role);

  const renderList = (role: TeamRole) => {
    const items = list(role);
    if (items.length === 0)
      return <p className="py-10 text-center text-sm text-muted-foreground">{t("users.empty")}</p>;
    return (
      <ul className="divide-y divide-border">
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3 gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{m.name}</div>
              <div className="text-sm text-muted-foreground truncate">{m.email}</div>
            </div>
            <div className="flex items-center gap-2">
              {role !== "inactive" && (
                <>
                  {role === "collaborator" ? (
                    <Button size="sm" variant="outline" onClick={() => setRole(m.id, "reviewer")}>
                      {t("users.makeReviewer")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setRole(m.id, "collaborator")}>
                      {t("users.makeCollaborator")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setRole(m.id, "inactive")}>
                    {t("users.deactivate")}
                  </Button>
                </>
              )}
              {role === "inactive" && (
                <Button size="sm" variant="outline" onClick={() => setRole(m.id, "collaborator")}>
                  {t("users.activate")}
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold mb-4">{t("users.invite")}</h2>
        <div className="grid sm:grid-cols-[1fr_1fr_180px_auto] gap-3 items-end">
          <div>
            <Label className="text-muted-foreground">{t("users.invitePh.name")}</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <Input
              type="email"
              placeholder={t("users.invitePh.email")}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-muted-foreground">{t("users.role")}</Label>
            <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as TeamRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collaborator">{t("users.role.collaborator")}</SelectItem>
                <SelectItem value="reviewer">{t("users.role.reviewer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={invite}><Plus className="h-4 w-4" /> {t("users.invite")}</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <Tabs defaultValue="collaborator">
          <TabsList>
            <TabsTrigger value="collaborator">{t("users.tab.collaborators")} ({list("collaborator").length})</TabsTrigger>
            <TabsTrigger value="reviewer">{t("users.tab.reviewers")} ({list("reviewer").length})</TabsTrigger>
            <TabsTrigger value="inactive">{t("users.tab.inactive")} ({list("inactive").length})</TabsTrigger>
          </TabsList>
          <TabsContent value="collaborator">{renderList("collaborator")}</TabsContent>
          <TabsContent value="reviewer">{renderList("reviewer")}</TabsContent>
          <TabsContent value="inactive">{renderList("inactive")}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
