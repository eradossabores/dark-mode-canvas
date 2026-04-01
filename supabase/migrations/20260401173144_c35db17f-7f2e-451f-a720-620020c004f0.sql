-- Allow super_admin to read all profiles
CREATE POLICY "Super admins can read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Allow super_admin to update any profile (for editing sócios)
CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));