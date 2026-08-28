/**
 * =============================================================================
 * Diálogo "Compartir roadmap" (Fase III)
 * =============================================================================
 * UI de colaboración por roadmap. Sólo el Roadmap Admin la ve; el backend y RLS
 * vuelven a comprobar el permiso en cada llamada, así que ocultar el botón es
 * comodidad, nunca la medida de seguridad.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Share2, Trash2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  listRoadmapMembers, listShareCandidates, shareRoadmap,
  updateRoadmapMemberRole, revokeRoadmapMember, transferRoadmapAdmin,
  type RoadmapMemberView, type ShareCandidate,
} from "@/lib/api/roadgate";

export function ShareRoadmapDialog({ roadmapId }: { roadmapId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<RoadmapMemberView[]>([]);
  const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);

  const reload = () => {
    Promise.all([listRoadmapMembers({ roadmapId }), listShareCandidates({ roadmapId })])
      .then(([m, c]) => { setMembers(m); setCandidates(c); })
      .catch((e) => { console.error(e); toast.error(t("share.error")); });
  };

  useEffect(() => { if (open) reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, roadmapId]);

  const run = async (fn: () => Promise<unknown>, okKey: TKey) => {
    setBusy(true);
    try { await fn(); toast.success(t(okKey)); reload(); }
    catch (e) { console.error(e); toast.error(t("share.error")); }
    finally { setBusy(false); }
  };

  const filtered = candidates.filter((c) =>
    (c.email ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Share2 className="h-4 w-4" /> {t("share.button")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("share.search")}
              className="h-9"
            />
            <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">{t("share.role.editor")}</SelectItem>
                <SelectItem value="viewer">{t("share.role.viewer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("share.noCandidates")}</p>
          )}
          {filtered.map((c) => (
            <div key={c.teamMemberId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{c.email ?? c.userId}</span>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(
                  () => shareRoadmap({ roadmapId, teamMemberId: c.teamMemberId, role }),
                  "share.shared",
                )}
              >
                {t("share.add")}
              </Button>
            </div>
          ))}

          <div className="pt-3 border-t border-border">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t("share.people")}
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.teamMemberId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{m.email ?? m.userId}</span>
                  {m.role === "admin" ? (
                    <span className="text-xs rounded-full bg-muted px-2 py-0.5">{t("share.role.admin")}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Select
                        value={m.role}
                        onValueChange={(v) => run(
                          () => updateRoadmapMemberRole({ roadmapId, memberId: m.id!, role: v as "editor" | "viewer" }),
                          "share.roleUpdated",
                        )}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">{t("share.role.editor")}</SelectItem>
                          <SelectItem value="viewer">{t("share.role.viewer")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8" disabled={busy}
                        title={t("share.transfer")}
                        onClick={() => {
                          if (!window.confirm(t("share.transferConfirm"))) return;
                          run(
                            () => transferRoadmapAdmin({ roadmapId, teamMemberId: m.teamMemberId }),
                            "share.transferred",
                          );
                        }}
                      >
                        <Crown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={busy} title={t("share.revoke")}
                        onClick={() => run(
                          () => revokeRoadmapMember({ roadmapId, memberId: m.id! }),
                          "share.revoked",
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
