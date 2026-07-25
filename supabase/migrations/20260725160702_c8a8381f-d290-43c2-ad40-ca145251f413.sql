
-- 1) roadmaps table
CREATE TABLE public.roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Hoja de ruta sin título',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmaps TO authenticated;
GRANT ALL ON public.roadmaps TO service_role;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own roadmaps" ON public.roadmaps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own roadmaps" ON public.roadmaps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own roadmaps" ON public.roadmaps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own roadmaps" ON public.roadmaps FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_roadmaps_updated_at BEFORE UPDATE ON public.roadmaps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) add roadmap_id to existing tables (nullable initially for backfill)
ALTER TABLE public.roadmap_items ADD COLUMN roadmap_id uuid REFERENCES public.roadmaps(id) ON DELETE CASCADE;
ALTER TABLE public.roadmap_capacity ADD COLUMN roadmap_id uuid REFERENCES public.roadmaps(id) ON DELETE CASCADE;

-- 3) backfill: one 'Mi Roadmap' per user that currently has data
INSERT INTO public.roadmaps (user_id, name)
SELECT DISTINCT user_id, 'Mi Roadmap' FROM (
  SELECT user_id FROM public.roadmap_items
  UNION
  SELECT user_id FROM public.roadmap_capacity
) u;

UPDATE public.roadmap_items ri
SET roadmap_id = r.id
FROM public.roadmaps r
WHERE r.user_id = ri.user_id AND ri.roadmap_id IS NULL AND r.name = 'Mi Roadmap';

UPDATE public.roadmap_capacity rc
SET roadmap_id = r.id
FROM public.roadmaps r
WHERE r.user_id = rc.user_id AND rc.roadmap_id IS NULL AND r.name = 'Mi Roadmap';

-- 4) enforce NOT NULL on roadmap_id going forward
ALTER TABLE public.roadmap_items ALTER COLUMN roadmap_id SET NOT NULL;

-- 5) capacity: switch primary key to (user_id, roadmap_id) so multiple roadmaps can coexist
ALTER TABLE public.roadmap_capacity ALTER COLUMN roadmap_id SET NOT NULL;
-- Drop old single-row-per-user constraint if any (was implicit via .maybeSingle usage). Add unique on roadmap_id.
ALTER TABLE public.roadmap_capacity ADD CONSTRAINT roadmap_capacity_roadmap_id_key UNIQUE (roadmap_id);

CREATE INDEX idx_roadmap_items_roadmap_id ON public.roadmap_items(roadmap_id);
CREATE INDEX idx_roadmaps_user_id ON public.roadmaps(user_id);
