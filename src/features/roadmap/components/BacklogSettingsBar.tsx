/**
 * BacklogSettingsBar — ajustes de alcance global del Backlog.
 * Controla qué tipos de work item se muestran y el modo "wrap text" (altura de
 * fila adaptada al contenido). La preferencia de tipos se guarda en el
 * navegador (ver `loadEnabledTypes` en ../constants).
 */
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WorkItemIcon } from "@/lib/work-item-icons";
import type { ItemType } from "@/lib/roadmap";
import { ALL_TYPES, TYPE_LABEL } from "../constants";

/** Ajustes que aplican a todo el Backlog (Epics, Features y User Stories). */
export function BacklogSettingsBar({
  wrapText, onWrapTextChange, enabledTypes, onEnabledTypesChange,
}: {
  wrapText: boolean;
  onWrapTextChange: (v: boolean) => void;
  enabledTypes: ItemType[];
  onEnabledTypesChange: (types: ItemType[]) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground leading-tight">Ajustes globales del Backlog</div>
          <div className="text-[11px] text-muted-foreground leading-tight">
            Se aplican a Epics, Features y User Stories
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 h-9">
          <Checkbox id="wrap-global" checked={wrapText} onCheckedChange={(v) => onWrapTextChange(v === true)} />
          <Label htmlFor="wrap-global" className="text-xs font-normal cursor-pointer whitespace-nowrap">
            Wrap text
          </Label>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="h-4 w-4" /> Tipos de work item ({enabledTypes.length}/{ALL_TYPES.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Elige los tipos que quieres usar
            </div>
            <div className="space-y-2">
              {ALL_TYPES.map((ty) => {
                const checked = enabledTypes.includes(ty);
                const isLastEnabled = checked && enabledTypes.length === 1;
                return (
                  <div key={ty} className="flex items-center gap-2">
                    <Checkbox
                      id={`et-${ty}`}
                      checked={checked}
                      disabled={isLastEnabled}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...enabledTypes, ty].filter((x, i, a) => a.indexOf(x) === i)
                          : enabledTypes.filter((x) => x !== ty);
                        onEnabledTypesChange(
                          next.length ? next.sort((a, b) => ALL_TYPES.indexOf(a) - ALL_TYPES.indexOf(b)) : enabledTypes,
                        );
                      }}
                    />
                    <Label htmlFor={`et-${ty}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <WorkItemIcon type={ty} className="h-4 w-4" />
                      {TYPE_LABEL[ty]}
                    </Label>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Debe quedar al menos un tipo activo.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
