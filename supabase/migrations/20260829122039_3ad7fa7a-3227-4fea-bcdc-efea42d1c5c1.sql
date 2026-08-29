CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.team_invitations%ROWTYPE;
  existing_member public.team_members%ROWTYPE;
  u_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'invitation_unauthenticated'; END IF;

  SELECT lower(email) INTO u_email FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.team_invitations WHERE token_hash = _token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_revoked'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;
  IF inv.email IS DISTINCT FROM u_email THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;

  SELECT * INTO existing_member
  FROM public.team_members
  WHERE team_id = inv.team_id AND user_id = uid;

  IF FOUND AND existing_member.status = 'inactive' THEN
    RAISE EXCEPTION 'invitation_target_inactive';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    IF existing_member.id IS NOT NULL AND existing_member.status = 'active' THEN
      RETURN inv.team_id;
    END IF;
    RAISE EXCEPTION 'invitation_already_used';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status, email)
  VALUES (inv.team_id, uid, 'member', 'active', u_email)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET email = EXCLUDED.email
  WHERE public.team_members.status = 'active';

  UPDATE public.team_invitations SET accepted_at = now() WHERE id = inv.id;

  RETURN inv.team_id;
END $$;

REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

-- ROLLBACK: restore the previous function body from migration
-- 20260828204833_ae2a0f6c-9dbf-492b-baf1-1f9fa8c671f9.sql. That rollback is
-- security-sensitive because it would again permit invitation-based
-- reactivation of an inactive member.