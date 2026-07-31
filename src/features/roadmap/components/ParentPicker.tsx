import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { WorkItemIcon } from "@/lib/work-item-icons";
import type { RoadmapItem } from "@/lib/roadmap";

/** Combobox con búsqueda para elegir el padre de un Feature / User Story. */
export function ParentPicker({
  value, parents, onChange,
}: {
  value?: string;
  parents: RoadmapItem[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parents.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm hover:bg-muted/40"
        >
          {selected ? (
            <span className="flex items-center gap-1 truncate">
              <WorkItemIcon type={selected.type} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selected.id} · {selected.title.slice(0, 30)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command
          filter={(val, search) => {
            if (!search) return 1;
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por ID o título..." className="h-9" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ ninguno sin padre"
                onSelect={() => { onChange(""); setOpen(false); }}
              >
                <span className="text-muted-foreground italic">— Sin padre —</span>
              </CommandItem>
              {parents.map((p) => (
                <CommandItem
                  key={p.uid}
                  value={`${p.id} ${p.title}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <WorkItemIcon type={p.type} className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{p.id}</span>
                  <span className="truncate text-xs">{p.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
