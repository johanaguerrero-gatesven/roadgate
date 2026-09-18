-- Fix: creating a roadmap failed because the read rule evaluates a stable
-- helper that cannot see the row inserted in the same statement (RETURNING).
-- Additive permissive policy: the owner can always read their own roadmaps
-- while they are an active member of the roadmap's team.
-- Rollback: DROP POLICY "Owners select own roadmaps" ON public.roadmaps;
CREATE POLICY "Owners select own roadmaps"
ON public.roadmaps
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid()))
);