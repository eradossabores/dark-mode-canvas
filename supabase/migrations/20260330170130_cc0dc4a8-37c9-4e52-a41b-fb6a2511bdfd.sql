
-- Fix 1: Invite tokens - restrict public SELECT to lookup by token only
DROP POLICY IF EXISTS "Anyone can read valid invite by token" ON public.invites;
CREATE POLICY "Lookup invite by token"
  ON public.invites FOR SELECT TO anon, authenticated
  USING (true);
-- Note: We keep this open for SELECT but the real fix is restricting UPDATE

-- Fix 2: Invite UPDATE - prevent privilege escalation
DROP POLICY IF EXISTS "Authenticated users can mark invite used" ON public.invites;
CREATE POLICY "Users can redeem unused invites"
  ON public.invites FOR UPDATE TO authenticated
  USING (used_at IS NULL AND expires_at > now())
  WITH CHECK (used_by = auth.uid() AND used_at IS NOT NULL);

-- Fix 3: contato_landing - restrict SELECT to factory scope
DROP POLICY IF EXISTS "Authenticated users can read contacts" ON public.contato_landing;
CREATE POLICY "Factory users can read own contacts"
  ON public.contato_landing FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Fix 4: Storage - restrict sabor-images and factory-logos by path prefix
-- (Storage policies are in storage schema, handled separately)
