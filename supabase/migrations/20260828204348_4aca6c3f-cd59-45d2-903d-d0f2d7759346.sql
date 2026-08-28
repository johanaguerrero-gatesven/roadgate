-- INC-01: las policies de tablas hijas deben validar la pertenencia del roadmap
CREATE OR REPLACE FUNCTION public.owns_roadmap(_roadmap_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.roadmaps r
    WHERE r.id = _roadmap_id
      AND r.user_id = _user_id
      AND (r.team_id IS NULL OR public.is_team_member(r.team_id, _user_id))
  );
$$;

REVOKE ALL ON FUNCTION public.owns_roadmap(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_roadmap(uuid, uuid) TO authenticated, service_role;

-- roadmap_items
DROP POLICY IF EXISTS "Users can insert their own roadmap items" ON public.roadmap_items;
CREATE POLICY "Users can insert their own roadmap items"
  ON public.roadmap_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update their own roadmap items" ON public.roadmap_items;
CREATE POLICY "Users can update their own roadmap items"
  ON public.roadmap_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own roadmap items" ON public.roadmap_items;
CREATE POLICY "Users can view their own roadmap items"
  ON public.roadmap_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

-- roadmap_capacity
DROP POLICY IF EXISTS "Users can insert their own capacity" ON public.roadmap_capacity;
CREATE POLICY "Users can insert their own capacity"
  ON public.roadmap_capacity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update their own capacity" ON public.roadmap_capacity;
CREATE POLICY "Users can update their own capacity"
  ON public.roadmap_capacity FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own capacity" ON public.roadmap_capacity;
CREATE POLICY "Users can view their own capacity"
  ON public.roadmap_capacity FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

-- roadmap_capacity_history
DROP POLICY IF EXISTS "Users can add their own capacity history" ON public.roadmap_capacity_history;
CREATE POLICY "Users can add their own capacity history"
  ON public.roadmap_capacity_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own capacity history" ON public.roadmap_capacity_history;
CREATE POLICY "Users can view their own capacity history"
  ON public.roadmap_capacity_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_roadmap(roadmap_id, auth.uid()));

-- INC-02: defensa en profundidad, anon no necesita acceso a ninguna tabla
REVOKE ALL ON public.roadmaps, public.roadmap_items, public.roadmap_capacity,
  public.roadmap_capacity_history, public.teams, public.team_members,
  public.api_keys, public.integration_credentials FROM anon;