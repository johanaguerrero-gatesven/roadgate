/**
 * ItemDetailDialog — pop-up de edición rápida de un work item.
 * Permite cambiar título, esfuerzo, quarter y prioridad. El esfuerzo se
 * bloquea (Σ de los hijos) cuando el item es un agrupador, y el quarter puede
 * mostrarse como "Multi-Quarter" (solo lectura) si sus hijos están repartidos.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RoadmapItem, Quarter, Priority, rolledUpEffort } from "@/lib/roadmap";
import { useI18n } from "@/lib/i18n";
import { WORK_ITEM_ICONS, WorkItemIcon } from "@/lib/work-item-icons";
import { PRIORITIES, PRIORITY_META, QUARTERS } from "../constants";

/** Pop-up de detalle/edición rápida de un work item del Roadmap. */
export function ItemDetailDialog({
  item, items, onClose, onUpdate, onMove,
}: {
  item: RoadmapItem | null;
  items: RoadmapItem[];
  onClose: () => void;
  onUpdate: (uid: string, patch: Partial<RoadmapItem>) => void;
  onMove: (uid: string, quarter: Quarter) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState("");

  useEffect(() => {
    if (item) {
      setTitle(item.title ?? "");
      setEffort(item.effort ? String(item.effort) : "");
    }
  }, [item?.uid]);

  if (!item) return null;
  const kids = items.filter((c) => c.parentId === item.id);
  const hasKids = kids.length > 0;
  const rolled = rolledUpEffort(item, items);
  const meta = WORK_ITEM_ICONS[item.type];
  // El quarter del padre ya viene derivado de sus hijos (puede ser "MULTI").
  const shownQuarter = (item.quarter ?? "") as Quarter;

  const save = () => {
    const patch: Partial<RoadmapItem> = {};
    if (title.trim() && title !== item.title) patch.title = title.trim();
    if (!hasKids) {
      const n = Number(effort);
      if (!Number.isNaN(n) && n !== (item.effort ?? 0)) patch.effort = n;
    }
    if (Object.keys(patch).length) onUpdate(item.uid, patch);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WorkItemIcon type={item.type} className="h-5 w-5" />
            <span>{item.id}</span>
            <Badge variant="outline" className={meta.badgeClass}>{meta.label}</Badge>
          </DialogTitle>
          <DialogDescription>{t("roadmap.detail.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("roadmap.detail.id")}</Label>
            <Input value={item.id} disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="detail-title">{t("roadmap.detail.title")}</Label>
            <Textarea id="detail-title" value={title} onChange={(e) => setTitle(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="detail-effort">{t("roadmap.detail.effort")}</Label>
              {hasKids ? (
                <>
                  <Input id="detail-effort" value={`Σ ${rolled}`} disabled />
                  <p className="text-[11px] text-muted-foreground">
                    {t("roadmap.detail.effortSum")}
                  </p>
                </>
              ) : (
                <Input
                  id="detail-effort"
                  type="number"
                  min={0}
                  value={effort}
                  onChange={(e) => setEffort(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("roadmap.detail.quarter")}</Label>
              <Select
                value={shownQuarter || "__bl"}
                onValueChange={(val) => onMove(item.uid, (val === "__bl" ? "" : val) as Quarter)}
              >
                <SelectTrigger><SelectValue placeholder="Q?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__bl">{t("roadmap.q.unassigned")}</SelectItem>
                  {QUARTERS.map((qq) => <SelectItem key={qq} value={qq}>{qq}</SelectItem>)}
                  {shownQuarter === "MULTI" && (
                    <SelectItem value="MULTI" disabled>{t("roadmap.detail.multi")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {shownQuarter === "MULTI" && (
                <p className="text-[11px] text-muted-foreground">
                  {t("roadmap.detail.multiHint")}
                </p>
              )}
              {hasKids && shownQuarter !== "MULTI" && (
                <p className="text-[11px] text-muted-foreground">
                  {t("roadmap.detail.kidsHint")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("roadmap.detail.priority")}</Label>
            <Select
              value={item.priority || "__none"}
              onValueChange={(v) => onUpdate(item.uid, { priority: v === "__none" ? "" : (v as Priority) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("roadmap.priority.none")}</SelectItem>
                {PRIORITIES.map((p) => {
                  const M = PRIORITY_META[p];
                  return (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <M.icon className={`h-4 w-4 ${M.cls}`} />
                        {p}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("roadmap.detail.cancel")}</Button>
          <Button onClick={save}>{t("roadmap.detail.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
