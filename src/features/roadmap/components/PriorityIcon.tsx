/**
 * PriorityIcon — icono de solo lectura de una prioridad.
 * Renderiza el guion de "sin prioridad" cuando el valor no está asignado.
 */
import { Minus } from "lucide-react";
import type { Priority } from "@/lib/roadmap";
import { PRIORITY_META, type RealPriority } from "../constants";

export function PriorityIcon({ p, className = "h-4 w-4" }: { p?: Priority; className?: string }) {
  if (!p) return <Minus className={`${className} text-muted-foreground/60`} />;
  const m = PRIORITY_META[p as RealPriority];
  const Icon = m.icon;
  return <Icon className={`${className} ${m.cls}`} />;
}
