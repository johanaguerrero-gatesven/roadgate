import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  defaultCapacity,
  type CapacityConfig,
  type DisplayMode,
  type ItemType,
  type Priority,
  type Quarter,
  type RoadmapItem,
  type State,
} from "./roadmap";

type ItemRow = {
  item_uid: string;
  item_code: string;
  type: string;
  title: string;
  description: string | null;
  parent_id: string | null;
  effort: number | string | null;
  priority: string | null;
  quarter: string | null;
  sprint: number | null;
  state: string | null;
  notes: string | null;
  tags: string | null;
  display_mode: string | null;
  hidden_from_roadmap: boolean;
};

function rowToItem(r: ItemRow): RoadmapItem {
  return {
    uid: r.item_uid,
    id: r.item_code,
    type: r.type as ItemType,
    title: r.title ?? "",
    description: r.description ?? undefined,
    parentId: r.parent_id ?? undefined,
    effort: r.effort == null ? undefined : Number(r.effort),
    priority: (r.priority ?? "") as Priority,
    quarter: (r.quarter ?? "") as Quarter,
    sprint: r.sprint ?? undefined,
    state: (r.state ?? "Backlog") as State,
    notes: r.notes ?? undefined,
    tags: r.tags ?? undefined,
    displayMode: (r.display_mode ?? undefined) as DisplayMode | undefined,
    hiddenFromRoadmap: !!r.hidden_from_roadmap,
  };
}

function itemToRow(it: RoadmapItem, userId: string) {
  return {
    user_id: userId,
    item_uid: it.uid,
    item_code: it.id,
    type: it.type,
    title: it.title ?? "",
    description: it.description ?? null,
    parent_id: it.parentId ?? null,
    effort: it.effort ?? null,
    priority: it.priority || null,
    quarter: it.quarter || null,
    sprint: it.sprint ?? null,
    state: it.state ?? null,
    notes: it.notes ?? null,
    tags: it.tags ?? null,
    display_mode: it.displayMode ?? null,
    hidden_from_roadmap: !!it.hiddenFromRoadmap,
  };
}

export const fetchRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [itemsRes, capRes] = await Promise.all([
      supabase.from("roadmap_items").select("*").eq("user_id", userId),
      supabase.from("roadmap_capacity").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (capRes.error) throw new Error(capRes.error.message);
    const items = ((itemsRes.data ?? []) as unknown as ItemRow[]).map(rowToItem);
    const capRow = capRes.data as unknown as {
      developers: number; dedication_pct: number | string; days_per_sprint: number;
      hours_per_day: number | string; sprints_per_quarter: number;
      sprints_by_quarter: Record<string, number> | null;
    } | null;
    const capacity: CapacityConfig = capRow
      ? {
          developers: capRow.developers,
          dedicationPct: Number(capRow.dedication_pct),
          daysPerSprint: capRow.days_per_sprint,
          hoursPerDay: Number(capRow.hours_per_day),
          sprintsPerQuarter: capRow.sprints_per_quarter,
          sprintsByQuarter: (capRow.sprints_by_quarter ?? {}) as CapacityConfig["sprintsByQuarter"],
        }
      : defaultCapacity;
    return { items, capacity };
  });

export const persistItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: RoadmapItem[] }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: delErr } = await supabase
      .from("roadmap_items")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    if (data.items.length) {
      const rows = data.items.map((it) => itemToRow(it, userId));
      const { error } = await supabase.from("roadmap_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const persistCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { capacity: CapacityConfig }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: delErr } = await supabase
      .from("roadmap_capacity")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    const { error } = await supabase.from("roadmap_capacity").insert({
      user_id: userId,
      developers: data.capacity.developers,
      dedication_pct: data.capacity.dedicationPct,
      days_per_sprint: data.capacity.daysPerSprint,
      hours_per_day: data.capacity.hoursPerDay,
      sprints_per_quarter: data.capacity.sprintsPerQuarter,
      sprints_by_quarter: data.capacity.sprintsByQuarter ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const resetRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error: e1 } = await supabase.from("roadmap_items").delete().eq("user_id", userId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.from("roadmap_capacity").delete().eq("user_id", userId);
    if (e2) throw new Error(e2.message);
    return { ok: true as const };
  });
