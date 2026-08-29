-- =============================================================================
-- FASE 4 · Offboarding y seguridad mínima (migración ADITIVA)
-- Rollback:
--   DROP TABLE IF EXISTS public.audit_events;
--   DROP FUNCTION IF EXISTS public.roadmaps_administered_by(uuid);
--   CREATE OR REPLACE FUNCTION public.roadmap_role(...)  -- versión previa (sin
--   la comprobación de membresía activa en la rama del dueño)
-- =============================================================================

-- 1. Registro de actividad administrativa -------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_email text,
  action text NOT NULL CHECK (action IN (
    'invitation.sent',
    'invitation.accepted',
    'member.status_changed',
    'roadmap.role_changed',
    'roadmap.access_revoked',
    'roadmap.admin_transferred'
  )),
  target_email text,
  target_user_id uuid,
  roadmap_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_team_created_idx
  ON public.audit_events (team_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Solo Team Admin consulta la actividad del equipo.
CREATE POLICY "Team admins read audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()));

-- Cualquier miembro activo puede dejar constancia de SUS propias acciones.
CREATE POLICY "Members append own audit events"
  ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND public.is_team_member(team_id, auth.uid()));

-- Sin UPDATE ni DELETE: el registro es inmutable.

-- 2. Desactivar retira el acceso también a los roadmaps propios ---------------
--    (antes, el dueño conservaba rol 'admin' aunque su membresía estuviese
--     inactiva; ahora se exige membresía ACTIVA cuando el roadmap tiene equipo)
CREATE OR REPLACE FUNCTION public.roadmap_role(_roadmap_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN r.user_id = _user_id
         AND (r.team_id IS NULL OR public.is_team_member(r.team_id, _user_id))
      THEN 'admin'
    ELSE (
      SELECT rm.role
      FROM public.roadmap_members rm
      JOIN public.team_members tm ON tm.id = rm.team_member_id
      WHERE rm.roadmap_id = r.id
        AND tm.user_id = _user_id
        AND tm.status = 'active'
        AND tm.team_id = r.team_id
      LIMIT 1
    )
  END
  FROM public.roadmaps r
  WHERE r.id = _roadmap_id;
$function$;

-- 3. Roadmaps que administra una persona (para exigir relevo antes de
--    desactivarla). Solo devuelve datos a quien es admin de ese equipo.
CREATE OR REPLACE FUNCTION public.roadmaps_administered_by(_member_id uuid)
RETURNS TABLE (roadmap_id uuid, roadmap_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.id, r.name
  FROM public.team_members tm
  JOIN public.roadmaps r
    ON r.team_id = tm.team_id AND r.user_id = tm.user_id
  WHERE tm.id = _member_id
    AND public.is_team_admin(tm.team_id, auth.uid())
  ORDER BY r.name;
$function$;

REVOKE ALL ON FUNCTION public.roadmaps_administered_by(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roadmaps_administered_by(uuid) TO authenticated;