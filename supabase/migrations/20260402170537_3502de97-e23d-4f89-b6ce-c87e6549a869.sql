-- Fix: Allow super_admin to read/manage all user_roles
DROP POLICY IF EXISTS "Admins manage all" ON public.user_roles;
CREATE POLICY "Admins manage all" ON public.user_roles
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));