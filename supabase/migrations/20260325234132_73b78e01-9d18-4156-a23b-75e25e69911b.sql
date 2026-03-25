
-- Security definer function to get user's factory
CREATE OR REPLACE FUNCTION public.get_user_factory_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT factory_id FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- RLS for factories
CREATE POLICY "Super admins manage all factories" ON public.factories
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Factory owners view own factory" ON public.factories
  FOR SELECT TO authenticated
  USING (id = get_user_factory_id(auth.uid()));

-- RLS for subscriptions
CREATE POLICY "Super admins manage all subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Factory owners view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()));
