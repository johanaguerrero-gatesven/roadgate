CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own global roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE id = '593d2df1-fb53-4a8f-b058-48b556cc8810'
ON CONFLICT (user_id, role) DO NOTHING;
COMMENT ON TABLE public.user_roles IS 'Global application roles, separate from team membership. Only privileged maintenance can assign roles.';
CREATE FUNCTION public.list_admin_registrations(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE (user_id uuid, email text, registered_at timestamptz, last_sign_in_at timestamptz, roadmap_count bigint, total_users bigint, total_roadmaps bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin') THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at,
    (SELECT count(*) FROM public.roadmaps rm WHERE rm.user_id = u.id),
    (SELECT count(*) FROM auth.users), (SELECT count(*) FROM public.roadmaps)
  FROM auth.users u ORDER BY u.created_at DESC, u.id
  LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 100) OFFSET GREATEST(COALESCE(_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.list_admin_registrations(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_registrations(integer, integer) TO authenticated;
COMMENT ON FUNCTION public.list_admin_registrations(integer, integer) IS 'Read-only global registration statistics; verifies caller global role before reading private data. Counts existing roadmaps by original creator, not shared roadmaps.';