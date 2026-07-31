import { Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Priority } from "@/lib/roadmap";
import { PRIORITIES, PRIORITY_META, type RealPriority } from "../constants";

/** Selector compacto de prioridad usado en las tarjetas del Roadmap. */
export function PriorityPicker({
  value,
  onChange,
  className = "h-4 w-4",
  size = "sm",
}: {
  value?: Priority;
  onChange: (p: Priority) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const current = value ? PRIORITY_META[value as RealPriority] : null;
  const priorityLabel = (p: RealPriority) => {
    switch (p) {
      case "1-High": return t("roadmap.priority.high");
      case "2-Medium": return t("roadmap.priority.medium");
      case "3-Low": return t("roadmap.priority.low");
      case "4-Lowest": return t("roadmap.priority.lowest");
    }
  };
  return (
    <Select
      value={value || "__none"}
      onValueChange={(v) => {
        const next = v === "__none" ? "" : (v as Priority);
        if (next !== value) onChange(next);
      }}
    >
      <SelectTrigger
        className={`border-0 bg-transparent hover:bg-muted/40 rounded shrink-0 p-0 px-1 flex flex-row items-center justify-center cursor-pointer [&>span]:line-clamp-none ${
          size === "md" ? "h-7 w-auto min-w-7" : "h-6 w-auto min-w-6"
        }`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        aria-label={t("roadmap.priority.none")}
      >
        {current ? (
          <span className="!flex flex-row items-center gap-1">
            <current.icon className={`${className} ${current.cls} shrink-0`} />
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap leading-none">{current.short}</span>
          </span>
        ) : (
          <span className="!flex flex-row items-center gap-1" title={t("roadmap.priority.none")}>
            <Minus className={`${className} text-muted-foreground/50 shrink-0`} />
            <span className="text-[10px] font-medium text-muted-foreground/60 whitespace-nowrap leading-none">--</span>
          </span>
        )}
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="__none" className="text-xs">
          <span className="flex items-center gap-2">
            <Minus className="h-3.5 w-3.5 text-muted-foreground/60" />
            {t("roadmap.priority.none")}
          </span>
        </SelectItem>
        {PRIORITIES.map((p) => {
          const m = PRIORITY_META[p];
          const Icon = m.icon;
          return (
            <SelectItem key={p} value={p} className="text-xs">
              <span className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${m.cls}`} />
                {priorityLabel(p)}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
