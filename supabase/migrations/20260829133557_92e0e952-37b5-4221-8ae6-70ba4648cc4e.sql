-- =============================================================================
-- Fase 5 · Comercialización simple por miembro activo (migración ADITIVA)
-- Rollback documentado al final. No borra ni renombra datos existentes.
-- =============================================================================

-- 1) Columnas de suscripción en teams -----------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS grace_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

-- Estados permitidos (validación por trigger: ver más abajo, evita CHECK sobre now())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_subscription_status_check'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_subscription_status_check
      CHECK (subscription_status IN ('trialing','active','past_due','grace_period','cancelled'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_plan_check'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_plan_check
      CHECK (plan IN ('free','solo','team','business'));
  END IF;
END $$;

-- 2) Backfill: los equipos existentes quedan ACTIVOS con su límite actual -----
UPDATE public.teams
   SET subscription_status = 'active',
       plan = CASE WHEN plan = 'free' THEN 'team' ELSE plan END
 WHERE trial_ends_at IS NULL
   AND subscription_status = 'trialing';

-- 3) Blindaje: nadie desde la app puede tocar los campos comerciales ----------
CREATE OR REPLACE FUNCTION public.protect_team_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- El service_role (webhooks firmados) y las funciones SECURITY DEFINER
  -- internas sí pueden cambiarlos; un usuario autenticado, nunca.
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.seat_limit := OLD.seat_limit;
  NEW.status := OLD.status;
  NEW.subscription_status := OLD.subscription_status;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.grace_days := OLD.grace_days;
  NEW.current_period_end := OLD.current_period_end;
  NEW.billing_provider := OLD.billing_provider;
  NEW.provider_customer_id := OLD.provider_customer_id;
  NEW.provider_subscription_id := OLD.provider_subscription_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_team_billing ON public.teams;
CREATE TRIGGER trg_protect_team_billing
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.protect_team_billing_fields();

-- 4) Trial de 14 días para equipos nuevos -------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_personal_team()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); t_id uuid; u_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT team_id INTO t_id FROM public.team_members
    WHERE user_id = uid AND status = 'active'
    ORDER BY (role = 'admin') DESC, created_at ASC LIMIT 1;
  IF t_id IS NOT NULL THEN RETURN t_id; END IF;
  SELECT email INTO u_email FROM auth.users WHERE id = uid;
  INSERT INTO public.teams (name, created_by, plan, seat_limit,
                            subscription_status, trial_started_at, trial_ends_at, grace_days)
    VALUES (COALESCE(split_part(u_email, '@', 1), 'My') || ' team', uid,
            'team', 5, 'trialing', now(), now() + interval '14 days', 7)
    RETURNING id INTO t_id;
  INSERT INTO public.team_members (team_id, user_id, role, status, email)
    VALUES (t_id, uid, 'admin', 'active', lower(u_email))
    ON CONFLICT (team_id, user_id) DO NOTHING;
  UPDATE public.roadmaps SET team_id = t_id WHERE user_id = uid AND team_id IS NULL;
  RETURN t_id;
END $function$;

-- 5) Idempotencia de webhooks --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- Tabla interna: SOLO el backend privilegiado (webhooks) la usa.
GRANT ALL ON public.billing_events TO service_role;
REVOKE ALL ON public.billing_events FROM anon, authenticated, PUBLIC;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to billing events"
  ON public.billing_events FOR SELECT TO authenticated USING (false);

-- =============================================================================
-- ROLLBACK MANUAL (no destructivo salvo por las columnas nuevas):
--   DROP TRIGGER IF EXISTS trg_protect_team_billing ON public.teams;
--   DROP FUNCTION IF EXISTS public.protect_team_billing_fields();
--   DROP TABLE IF EXISTS public.billing_events;
--   ALTER TABLE public.teams
--     DROP CONSTRAINT IF EXISTS teams_subscription_status_check,
--     DROP CONSTRAINT IF EXISTS teams_plan_check,
--     DROP COLUMN IF EXISTS trial_started_at,
--     DROP COLUMN IF EXISTS trial_ends_at,
--     DROP COLUMN IF EXISTS subscription_status,
--     DROP COLUMN IF EXISTS grace_days,
--     DROP COLUMN IF EXISTS current_period_end,
--     DROP COLUMN IF EXISTS billing_provider,
--     DROP COLUMN IF EXISTS provider_customer_id,
--     DROP COLUMN IF EXISTS provider_subscription_id;
--   (y restaurar la versión previa de ensure_personal_team sin campos de trial)
-- AVISO: revertir el trigger permite de nuevo que un Team Admin edite su plan.
-- =============================================================================