import { LucideIcon, Hexagon, Bookmark, FileText } from "lucide-react";
import { ItemType } from "@/lib/roadmap";

export type WorkItemIconMeta = {
  icon: LucideIcon;
  colorClass: string;
  label: string;
  badgeClass: string;
};

export const WORK_ITEM_ICONS: Record<ItemType, WorkItemIconMeta> = {
  epic: {
    icon: Hexagon,
    colorClass: "text-orange-500",
    label: "Epic",
    badgeClass:
      "bg-primary/15 text-primary border-primary/30",
  },
  feature: {
    icon: Bookmark,
    colorClass: "text-purple-500",
    label: "Feature",
    badgeClass:
      "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  story: {
    icon: FileText,
    colorClass: "text-blue-500",
    label: "User Story",
    badgeClass:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
};

export function WorkItemIcon({
  type,
  className = "h-4 w-4",
}: {
  type: ItemType;
  className?: string;
}) {
  const meta = WORK_ITEM_ICONS[type];
  const Icon = meta.icon;
  return (
    <span title={meta.label} className="inline-flex">
      <Icon className={`${className} ${meta.colorClass}`} />
    </span>
  );
}
