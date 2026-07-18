
-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- roadmap_items: backlog entries per user (Epic / Feature / Story)
-- ============================================================
CREATE TABLE public.roadmap_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_uid TEXT NOT NULL,
  item_code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('epic','feature','story')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  parent_id TEXT,
  effort NUMERIC,
  priority TEXT,
  quarter TEXT,
  sprint INTEGER,
  state TEXT,
  notes TEXT,
  tags TEXT,
  display_mode TEXT,
  hidden_from_roadmap BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_uid)
);

CREATE INDEX roadmap_items_user_idx ON public.roadmap_items(user_id);
CREATE INDEX roadmap_items_user_parent_idx ON public.roadmap_items(user_id, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_items TO authenticated;
GRANT ALL ON public.roadmap_items TO service_role;

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roadmap items"
  ON public.roadmap_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roadmap items"
  ON public.roadmap_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roadmap items"
  ON public.roadmap_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roadmap items"
  ON public.roadmap_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- roadmap_capacity: one capacity config per user
-- ============================================================
CREATE TABLE public.roadmap_capacity (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  developers INTEGER NOT NULL DEFAULT 7,
  dedication_pct NUMERIC NOT NULL DEFAULT 30,
  days_per_sprint INTEGER NOT NULL DEFAULT 10,
  hours_per_day NUMERIC NOT NULL DEFAULT 5,
  sprints_per_quarter INTEGER NOT NULL DEFAULT 5,
  sprints_by_quarter JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_capacity TO authenticated;
GRANT ALL ON public.roadmap_capacity TO service_role;

ALTER TABLE public.roadmap_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own capacity"
  ON public.roadmap_capacity FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own capacity"
  ON public.roadmap_capacity FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own capacity"
  ON public.roadmap_capacity FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own capacity"
  ON public.roadmap_capacity FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_roadmap_capacity_updated_at
  BEFORE UPDATE ON public.roadmap_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
