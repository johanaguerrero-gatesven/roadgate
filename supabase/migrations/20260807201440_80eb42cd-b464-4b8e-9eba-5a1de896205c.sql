-- Owner-scoped policies for integration_credentials.
-- The table already has RLS enabled but no policies, so nobody (not even the owner)
-- can read their own rows. Grants are intentionally limited: no anon access.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;

CREATE POLICY "Users can view their own integration credentials"
  ON public.integration_credentials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integration credentials"
  ON public.integration_credentials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integration credentials"
  ON public.integration_credentials FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integration credentials"
  ON public.integration_credentials FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Defense in depth: the encrypted token must never be readable through the Data API.
-- Only the server (service_role) may select it.
REVOKE SELECT (token_ciphertext) ON public.integration_credentials FROM authenticated;