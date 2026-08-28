/**
 * NewItemDialog — alta manual de un work item desde el Backlog.
 * Permite capturar Title, Description, Parent, Effort, Priority, Quarter,
 * State, Tags y Notes. El ID NO se pide: lo asigna la herramienta de gestión
 * de iteraciones, así que el item nace con un ID temporal (TBD-xx) marcado
 * como pendiente.
 */
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import type { ItemType, Priority, Quarter, RoadmapItem } from "@/lib/roadmap";
import { WorkItemIcon, WORK_ITEM_ICONS } from "@/lib/work-item-icons";
import { PRIORITIES, PRIORITY_META, QUARTERS } from "../constants";
import { ParentPicker } from "./ParentPicker";

const STATES: NonNullable<RoadmapItem["state"]>[] = ["Backlog", "In Progress", "Done", "Blocked"];

export type NewItemDraft = Omit<RoadmapItem, "uid" | "id" | "type">;

export function NewItemDialog({
  open, type, parents, onClose, onCreate,
}: {
  open: boolean;
  type: ItemType;
  parents: RoadmapItem[];
  onClose: () => void;
  onCreate: (draft: NewItemDraft) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [effort, setEffort] = useState("");
  const [priority, setPriority] = useState<Priority>("3-Low");
  const [quarter, setQuarter] = useState<Quarter>("");
  const [state, setState] = useState<NonNullable<RoadmapItem["state"]>>("Backlog");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(""); setDescription(""); setParentId(undefined); setEffort("");
    setPriority("3-Low"); setQuarter(""); setState("Backlog"); setTags(""); setNotes("");
  }, [open, type]);

  const effortNum = effort === "" ? 0 : Number(effort);
  const planning = quarter !== "";
  const missingEffort = planning && !(effortNum > 0);
  const canSave = title.trim().length > 0 && !missingEffort;

  const submit = () => {
    if (!canSave) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      parentId: parentId || undefined,
      effort: effortNum > 0 ? effortNum : undefined,
      priority,
      quarter,
      state,
      tags: tags.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const meta = WORK_ITEM_ICONS[type];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WorkItemIcon type={type} className="h-5 w-5" />
            {t("roadmap.newItem.title")} · {meta.label}
          </DialogTitle>
          <DialogDescription>{t("roadmap.newItem.desc")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/80">{t("roadmap.newItem.pendingId")}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-title">{t("roadmap.col.title")} *</Label>
            <Textarea id="new-title" rows={2} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-desc">{t("roadmap.newItem.description")}</Label>
            <Textarea id="new-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {type !== "epic" && (
            <div className="space-y-1.5">
              <Label>{t("roadmap.col.parent")}</Label>
              <ParentPicker value={parentId} parents={parents} onChange={(v) => setParentId(v || undefined)} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-effort">{t("roadmap.col.effort")}</Label>
              <Input
                id="new-effort" type="number" min={0} value={effort}
                onChange={(e) => setEffort(e.target.value)} placeholder="0"
              />
              {missingEffort && (
                <p className="text-[11px] text-destructive">{t("roadmap.newItem.effortRequired")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("roadmap.col.priority")}</Label>
              <Select value={priority || "__none"} onValueChange={(v) => setPriority(v === "__none" ? "" : (v as Priority))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("roadmap.priority.none")}</SelectItem>
                  {PRIORITIES.map((p) => {
                    const M = PRIORITY_META[p];
                    return (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <M.icon className={`h-4 w-4 ${M.cls}`} /> {M.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("roadmap.col.quarter")}</Label>
              <Select value={quarter || "__bl"} onValueChange={(v) => setQuarter(v === "__bl" ? "" : (v as Quarter))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__bl">{t("roadmap.q.unassigned")}</SelectItem>
                  {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("roadmap.newItem.state")}</Label>
              <Select value={state} onValueChange={(v) => setState(v as NonNullable<RoadmapItem["state"]>)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-tags">{t("roadmap.newItem.tags")}</Label>
              <Input id="new-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-notes">{t("roadmap.newItem.notes")}</Label>
            <Textarea id="new-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("roadmap.detail.cancel")}</Button>
          <Button onClick={submit} disabled={!canSave}>{t("roadmap.newItem.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
