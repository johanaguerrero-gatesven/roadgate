CREATE TABLE public.roadmap_capacity_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users,
  changed_by_email TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.roadmap_capacity_history TO authenticated;
GRANT ALL ON public.roadmap_capacity_history TO service_role;

ALTER TABLE public.roadmap_capacity_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own capacity history"
  ON public.roadmap_capacity_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own capacity history"
  ON public.roadmap_capacity_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX roadmap_capacity_history_roadmap_idx
  ON public.roadmap_capacity_history (roadmap_id, created_at DESC);