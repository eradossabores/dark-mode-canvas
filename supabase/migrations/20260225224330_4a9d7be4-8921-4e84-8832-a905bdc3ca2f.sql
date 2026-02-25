
-- Drop existing restrictive policies on user_roles
DROP POLICY IF EXISTS "Admins manage all" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can read own role"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all"
  ON public.user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
