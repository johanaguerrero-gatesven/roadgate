-- =============================================================================
-- FASE I: cuentas de equipo (aditiva, con rollback documentado)
-- Rollback:
--   ALTER TABLE public.roadmaps DROP COLUMN IF EXISTS admin_member_id;
--   ALTER TABLE public.roadmaps DROP COLUMN IF EXISTS team_id;
--   DROP FUNCTION IF EXISTS public.ensure_personal_team();
--   DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.is_team_admin(uuid, uuid);
--   DROP TABLE IF EXISTS public.team_members;
--   DROP TABLE IF EXISTS public.teams;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My team',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'free',
  seat_limit integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- Helpers SECURITY DEFINER (evitan recursión en RLS) ----------------------
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
      AND status = 'active' AND role = 'admin'
  );
$$;

-- --- Políticas ---------------------------------------------------------------
CREATE POLICY "Members can view their teams" ON public.teams
  FOR SELECT TO authenticated USING (public.is_team_member(id, auth.uid()));
CREATE POLICY "Users can create their own team" ON public.teams
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Team admins can update their team" ON public.teams
  FOR UPDATE TO authenticated USING (public.is_team_admin(id, auth.uid()))
  WITH CHECK (public.is_team_admin(id, auth.uid()));
CREATE POLICY "Team admins can delete their team" ON public.teams
  FOR DELETE TO authenticated USING (public.is_team_admin(id, auth.uid()));

CREATE POLICY "Members can view team memberships" ON public.team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(team_id, auth.uid()));
CREATE POLICY "Team admins manage memberships" ON public.team_members
  FOR INSERT TO authenticated WITH CHECK (public.is_team_admin(team_id, auth.uid()));
CREATE POLICY "Team admins update memberships" ON public.team_members
  FOR UPDATE TO authenticated USING (public.is_team_admin(team_id, auth.uid()))
  WITH CHECK (public.is_team_admin(team_id, auth.uid()));
CREATE POLICY "Team admins delete memberships" ON public.team_members
  FOR DELETE TO authenticated USING (public.is_team_admin(team_id, auth.uid()));

-- --- Columnas nuevas en roadmaps --------------------------------------------
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS admin_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS roadmaps_team_idx ON public.roadmaps(team_id);

-- --- Backfill: un equipo propio por usuario existente ------------------------
DO $$
DECLARE u RECORD; t_id uuid; m_id uuid;
BEGIN
  FOR u IN SELECT id, email FROM auth.users LOOP
    SELECT tm.team_id INTO t_id FROM public.team_members tm
      WHERE tm.user_id = u.id AND tm.role = 'admin' LIMIT 1;
    IF t_id IS NULL THEN
      INSERT INTO public.teams (name, created_by)
        VALUES (COALESCE(split_part(u.email, '@', 1), 'My') || ' team', u.id)
        RETURNING id INTO t_id;
      INSERT INTO public.team_members (team_id, user_id, role, status)
        VALUES (t_id, u.id, 'admin', 'active') RETURNING id INTO m_id;
    ELSE
      SELECT id INTO m_id FROM public.team_members
        WHERE team_id = t_id AND user_id = u.id;
    END IF;
    UPDATE public.roadmaps SET team_id = t_id, admin_member_id = m_id
      WHERE user_id = u.id AND team_id IS NULL;
  END LOOP;
END $$;

-- --- Alta automática idempotente para nuevos registros -----------------------
CREATE OR REPLACE FUNCTION public.ensure_personal_team()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t_id uuid; u_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT team_id INTO t_id FROM public.team_members
    WHERE user_id = uid AND status = 'active'
    ORDER BY (role = 'admin') DESC, created_at ASC LIMIT 1;
  IF t_id IS NOT NULL THEN RETURN t_id; END IF;
  SELECT email INTO u_email FROM auth.users WHERE id = uid;
  INSERT INTO public.teams (name, created_by)
    VALUES (COALESCE(split_part(u_email, '@', 1), 'My') || ' team', uid)
    RETURNING id INTO t_id;
  INSERT INTO public.team_members (team_id, user_id, role, status)
    VALUES (t_id, uid, 'admin', 'active')
    ON CONFLICT (team_id, user_id) DO NOTHING;
  UPDATE public.roadmaps SET team_id = t_id WHERE user_id = uid AND team_id IS NULL;
  RETURN t_id;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_team() TO authenticated;

-- --- Endurecer roadmaps: propietario Y miembro del equipo del roadmap --------
DROP POLICY IF EXISTS "Users select own roadmaps" ON public.roadmaps;
DROP POLICY IF EXISTS "Users insert own roadmaps" ON public.roadmaps;
DROP POLICY IF EXISTS "Users update own roadmaps" ON public.roadmaps;
DROP POLICY IF EXISTS "Users delete own roadmaps" ON public.roadmaps;

CREATE POLICY "Users select own roadmaps" ON public.roadmaps
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users insert own roadmaps" ON public.roadmaps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users update own roadmaps" ON public.roadmaps
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())))
  WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users delete own roadmaps" ON public.roadmaps
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));