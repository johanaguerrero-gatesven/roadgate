REVOKE ALL ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_team_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_personal_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_personal_team() TO authenticated;