import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Input de ID con commit en blur/Enter; nunca permite dejarlo vacío. */
export function IdInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const commit = () => {
    const trimmed = local.trim();
    if (!trimmed) { setLocal(value); return; }
    if (trimmed !== value) onCommit(trimmed);
  };
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder="ID"
      className="h-8 px-2 text-xs font-mono font-semibold"
    />
  );
}
