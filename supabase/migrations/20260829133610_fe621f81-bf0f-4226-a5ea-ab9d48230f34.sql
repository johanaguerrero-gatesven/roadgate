REVOKE ALL ON FUNCTION public.protect_team_billing_fields() FROM PUBLIC, anon, authenticated;
-- Rollback: GRANT EXECUTE ON FUNCTION public.protect_team_billing_fields() TO authenticated;