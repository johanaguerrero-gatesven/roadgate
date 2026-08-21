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
    colorClass: "text-epic",
    label: "Epic",
    badgeClass: "bg-epic/15 text-epic border-epic/30",
  },
  feature: {
    icon: Bookmark,
    colorClass: "text-feature",
    label: "Feature",
    badgeClass: "bg-feature/15 text-feature border-feature/30",
  },
  story: {
    icon: FileText,
    colorClass: "text-story",
    label: "User Story",
    badgeClass: "bg-story/15 text-story border-story/30",
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
