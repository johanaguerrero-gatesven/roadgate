BEGIN;

-- Preflight: the existing UNIQUE constraint proves roadmap_id can safely become
-- the row identity without deleting or merging any capacity data.
DO $$
BEGIN
  IF EXISTS (
    SELECT roadmap_id
    FROM public.roadmap_capacity
    GROUP BY roadmap_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'roadmap_capacity contains duplicate roadmap_id values';
  END IF;
END
$$;

ALTER TABLE public.roadmap_capacity
  DROP CONSTRAINT IF EXISTS roadmap_capacity_pkey;

ALTER TABLE public.roadmap_capacity
  DROP CONSTRAINT IF EXISTS roadmap_capacity_roadmap_id_key;

ALTER TABLE public.roadmap_capacity
  ADD CONSTRAINT roadmap_capacity_pkey PRIMARY KEY (roadmap_id);

-- Protected collaboration data must never be reachable through the anonymous
-- Data API role. RLS remains the second, row-level authorization barrier.
REVOKE ALL PRIVILEGES ON TABLE public.team_invitations FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.team_invitations FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM PUBLIC;

-- Preserve the least privileges required by the existing authenticated flows.
GRANT SELECT, INSERT, UPDATE ON TABLE public.team_invitations TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.team_invitations TO service_role;
GRANT SELECT, INSERT ON TABLE public.audit_events TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.audit_events TO service_role;

COMMIT;

-- ROLLBACK (manual and coordinated; do not run while a user owns capacity for
-- more than one roadmap, because restoring PRIMARY KEY(user_id) would fail and
-- would reintroduce the Phase III/IV data-loss defect):
-- BEGIN;
-- ALTER TABLE public.roadmap_capacity DROP CONSTRAINT roadmap_capacity_pkey;
-- ALTER TABLE public.roadmap_capacity ADD CONSTRAINT roadmap_capacity_roadmap_id_key UNIQUE (roadmap_id);
-- ALTER TABLE public.roadmap_capacity ADD CONSTRAINT roadmap_capacity_pkey PRIMARY KEY (user_id);
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_invitations TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_events TO anon;
-- COMMIT;