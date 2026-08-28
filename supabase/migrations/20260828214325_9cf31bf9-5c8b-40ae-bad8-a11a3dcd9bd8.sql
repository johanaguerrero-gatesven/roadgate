-- =============================================================================
-- FASE III — Roadmap como workspace colaborativo (Admin / Editor / Viewer)
-- Migración ADITIVA. No borra ni renombra datos existentes.
-- Rollback al final del fichero (comentado).
-- =============================================================================

-- 1) Tabla de miembros de roadmap ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roadmap_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS roadmap_members_roadmap_idx ON public.roadmap_members(roadmap_id);
CREATE INDEX IF NOT EXISTS roadmap_members_team_member_idx ON public.roadmap_members(team_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_members TO authenticated;
GRANT ALL ON public.roadmap_members TO service_role;
REVOKE ALL ON public.roadmap_members FROM anon;

ALTER TABLE public.roadmap_members ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_roadmap_members_updated_at ON public.roadmap_members;
CREATE TRIGGER update_roadmap_members_updated_at
  BEFORE UPDATE ON public.roadmap_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Funciones de autorización (SECURITY DEFINER, evitan recursión en RLS) --------

-- Rol efectivo del usuario sobre un roadmap: 'admin' | 'editor' | 'viewer' | NULL
CREATE OR REPLACE FUNCTION public.roadmap_role(_roadmap_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN r.user_id = _user_id THEN 'admin'
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
$$;

CREATE OR REPLACE FUNCTION public.can_read_roadmap(_roadmap_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.roadmap_role(_roadmap_id, _user_id) IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION public.can_write_roadmap(_roadmap_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.roadmap_role(_roadmap_id, _user_id) IN ('admin','editor'); $$;

CREATE OR REPLACE FUNCTION public.is_roadmap_admin(_roadmap_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.roadmap_role(_roadmap_id, _user_id) = 'admin'; $$;

REVOKE ALL ON FUNCTION public.roadmap_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_roadmap(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_roadmap(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_roadmap_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roadmap_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_roadmap(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_roadmap(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_roadmap_admin(uuid, uuid) TO authenticated, service_role;

-- 3) RLS de roadmap_members -------------------------------------------------------
DROP POLICY IF EXISTS "Roadmap readers view shares" ON public.roadmap_members;
CREATE POLICY "Roadmap readers view shares" ON public.roadmap_members
  FOR SELECT TO authenticated
  USING (public.can_read_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Roadmap admin creates shares" ON public.roadmap_members;
CREATE POLICY "Roadmap admin creates shares" ON public.roadmap_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_roadmap_admin(roadmap_id, auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.roadmaps r ON r.id = roadmap_id
      WHERE tm.id = team_member_id AND tm.status = 'active' AND tm.team_id = r.team_id
    )
  );

DROP POLICY IF EXISTS "Roadmap admin updates shares" ON public.roadmap_members;
CREATE POLICY "Roadmap admin updates shares" ON public.roadmap_members
  FOR UPDATE TO authenticated
  USING (public.is_roadmap_admin(roadmap_id, auth.uid()))
  WITH CHECK (public.is_roadmap_admin(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Roadmap admin deletes shares" ON public.roadmap_members;
CREATE POLICY "Roadmap admin deletes shares" ON public.roadmap_members
  FOR DELETE TO authenticated
  USING (public.is_roadmap_admin(roadmap_id, auth.uid()));

-- 4) RLS de roadmaps: lectura/edición compartida, borrado sólo Admin ---------------
DROP POLICY IF EXISTS "Users select own roadmaps" ON public.roadmaps;
CREATE POLICY "Roadmap readers select roadmaps" ON public.roadmaps
  FOR SELECT TO authenticated
  USING (public.can_read_roadmap(id, auth.uid()));

DROP POLICY IF EXISTS "Users update own roadmaps" ON public.roadmaps;
CREATE POLICY "Roadmap writers update roadmaps" ON public.roadmaps
  FOR UPDATE TO authenticated
  USING (public.can_write_roadmap(id, auth.uid()))
  WITH CHECK (public.can_write_roadmap(id, auth.uid()));

DROP POLICY IF EXISTS "Users delete own roadmaps" ON public.roadmaps;
CREATE POLICY "Roadmap admin deletes roadmaps" ON public.roadmaps
  FOR DELETE TO authenticated
  USING (public.is_roadmap_admin(id, auth.uid()));

-- 5) RLS de tablas hijas: acceso por rol de roadmap --------------------------------
DROP POLICY IF EXISTS "Users can view their own roadmap items" ON public.roadmap_items;
DROP POLICY IF EXISTS "Users can insert their own roadmap items" ON public.roadmap_items;
DROP POLICY IF EXISTS "Users can update their own roadmap items" ON public.roadmap_items;
DROP POLICY IF EXISTS "Users can delete their own roadmap items" ON public.roadmap_items;

CREATE POLICY "Roadmap readers view items" ON public.roadmap_items
  FOR SELECT TO authenticated USING (public.can_read_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers insert items" ON public.roadmap_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_write_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers update items" ON public.roadmap_items
  FOR UPDATE TO authenticated
  USING (public.can_write_roadmap(roadmap_id, auth.uid()))
  WITH CHECK (public.can_write_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers delete items" ON public.roadmap_items
  FOR DELETE TO authenticated USING (public.can_write_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own capacity" ON public.roadmap_capacity;
DROP POLICY IF EXISTS "Users can insert their own capacity" ON public.roadmap_capacity;
DROP POLICY IF EXISTS "Users can update their own capacity" ON public.roadmap_capacity;
DROP POLICY IF EXISTS "Users can delete their own capacity" ON public.roadmap_capacity;

CREATE POLICY "Roadmap readers view capacity" ON public.roadmap_capacity
  FOR SELECT TO authenticated USING (public.can_read_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers insert capacity" ON public.roadmap_capacity
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_write_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers update capacity" ON public.roadmap_capacity
  FOR UPDATE TO authenticated
  USING (public.can_write_roadmap(roadmap_id, auth.uid()))
  WITH CHECK (public.can_write_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers delete capacity" ON public.roadmap_capacity
  FOR DELETE TO authenticated USING (public.can_write_roadmap(roadmap_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own capacity history" ON public.roadmap_capacity_history;
DROP POLICY IF EXISTS "Users can add their own capacity history" ON public.roadmap_capacity_history;

CREATE POLICY "Roadmap readers view capacity history" ON public.roadmap_capacity_history
  FOR SELECT TO authenticated USING (public.can_read_roadmap(roadmap_id, auth.uid()));
CREATE POLICY "Roadmap writers add capacity history" ON public.roadmap_capacity_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_write_roadmap(roadmap_id, auth.uid()));

-- 6) Transferencia transaccional de Roadmap Admin ----------------------------------
CREATE OR REPLACE FUNCTION public.transfer_roadmap_admin(_roadmap_id uuid, _team_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.roadmaps%ROWTYPE;
  target public.team_members%ROWTYPE;
  current_member_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'transfer_unauthenticated'; END IF;

  SELECT * INTO r FROM public.roadmaps WHERE id = _roadmap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'roadmap_not_found'; END IF;
  IF r.user_id <> uid THEN RAISE EXCEPTION 'transfer_forbidden'; END IF;

  SELECT * INTO target FROM public.team_members WHERE id = _team_member_id;
  IF NOT FOUND OR target.status <> 'active' OR target.team_id IS DISTINCT FROM r.team_id THEN
    RAISE EXCEPTION 'transfer_invalid_member';
  END IF;
  IF target.user_id = uid THEN RAISE EXCEPTION 'transfer_same_user'; END IF;

  -- El nuevo admin deja de ser miembro compartido
  DELETE FROM public.roadmap_members WHERE roadmap_id = _roadmap_id AND team_member_id = _team_member_id;

  -- El admin anterior pasa a Editor
  SELECT id INTO current_member_id FROM public.team_members
    WHERE user_id = uid AND team_id = r.team_id AND status = 'active' LIMIT 1;
  IF current_member_id IS NOT NULL THEN
    INSERT INTO public.roadmap_members (roadmap_id, team_member_id, role, created_by, updated_by)
    VALUES (_roadmap_id, current_member_id, 'editor', uid, uid)
    ON CONFLICT (roadmap_id, team_member_id)
      DO UPDATE SET role = 'editor', updated_by = uid, updated_at = now();
  END IF;

  -- Único admin del roadmap
  UPDATE public.roadmaps
     SET user_id = target.user_id, admin_member_id = target.id, updated_at = now()
   WHERE id = _roadmap_id;

  RETURN _roadmap_id;
END $$;

REVOKE ALL ON FUNCTION public.transfer_roadmap_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_roadmap_admin(uuid, uuid) TO authenticated, service_role;

-- 7) Backfill: garantizar admin_member_id en roadmaps existentes --------------------
UPDATE public.roadmaps r
   SET admin_member_id = tm.id
  FROM public.team_members tm
 WHERE r.admin_member_id IS NULL
   AND tm.user_id = r.user_id
   AND tm.team_id = r.team_id
   AND tm.status = 'active';

-- =============================================================================
-- ROLLBACK (ejecutar manualmente si hiciera falta):
--   DROP FUNCTION IF EXISTS public.transfer_roadmap_admin(uuid, uuid);
--   DROP TABLE IF EXISTS public.roadmap_members;
--   DROP FUNCTION IF EXISTS public.can_read_roadmap(uuid,uuid), public.can_write_roadmap(uuid,uuid),
--                           public.is_roadmap_admin(uuid,uuid), public.roadmap_role(uuid,uuid) CASCADE;
--   -- y recrear las políticas previas basadas en owns_roadmap()/user_id.
-- =============================================================================
