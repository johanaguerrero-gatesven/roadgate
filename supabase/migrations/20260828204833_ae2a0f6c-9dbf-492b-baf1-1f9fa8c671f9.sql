-- === Fase II: gestión de miembros del equipo (aditiva) =======================

-- 1) Email denormalizado en team_members (para mostrar la lista sin Auth Admin)
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS email text;

UPDATE public.team_members tm
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = tm.user_id AND tm.email IS DISTINCT FROM lower(u.email);

-- 2) Tabla de invitaciones
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invitations_token_hash
  ON public.team_invitations (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invitations_pending
  ON public.team_invitations (team_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON public.team_invitations (team_id);

GRANT SELECT, INSERT, UPDATE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team admins view invitations"
  ON public.team_invitations FOR SELECT TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Team admins create invitations"
  ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_team_admin(team_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Team admins update invitations"
  ON public.team_invitations FOR UPDATE TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()))
  WITH CHECK (public.is_team_admin(team_id, auth.uid()));

CREATE TRIGGER update_team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Aceptación de invitación (idempotente, siempre como 'member')
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.team_invitations%ROWTYPE;
  u_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'invitation_unauthenticated'; END IF;

  SELECT lower(email) INTO u_email FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.team_invitations WHERE token_hash = _token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_revoked'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;
  IF inv.email IS DISTINCT FROM u_email THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;

  IF inv.accepted_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = inv.team_id AND user_id = uid) THEN
      RETURN inv.team_id;  -- idempotente
    END IF;
    RAISE EXCEPTION 'invitation_already_used';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status, email)
  VALUES (inv.team_id, uid, 'member', 'active', u_email)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET status = 'active', email = EXCLUDED.email;

  UPDATE public.team_invitations SET accepted_at = now() WHERE id = inv.id;

  RETURN inv.team_id;
END $$;

REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

-- 4) ensure_personal_team ahora guarda también el email
CREATE OR REPLACE FUNCTION public.ensure_personal_team()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  INSERT INTO public.team_members (team_id, user_id, role, status, email)
    VALUES (t_id, uid, 'admin', 'active', lower(u_email))
    ON CONFLICT (team_id, user_id) DO NOTHING;
  UPDATE public.roadmaps SET team_id = t_id WHERE user_id = uid AND team_id IS NULL;
  RETURN t_id;
END $$;