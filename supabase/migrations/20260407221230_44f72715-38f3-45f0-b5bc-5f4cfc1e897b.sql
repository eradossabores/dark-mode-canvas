
-- Fix prospectos: scope by factory_id
DROP POLICY IF EXISTS "Admins can manage prospectos" ON public.prospectos;
CREATE POLICY "Factory admins can manage prospectos"
ON public.prospectos
FOR ALL
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- Fix prospecto_visitas: scope by factory_id
DROP POLICY IF EXISTS "Admins can manage prospecto_visitas" ON public.prospecto_visitas;
CREATE POLICY "Factory admins can manage prospecto_visitas"
ON public.prospecto_visitas
FOR ALL
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- Fix user_roles: scope admin management by factory
DROP POLICY IF EXISTS "Admins manage all" ON public.user_roles;
CREATE POLICY "Admins manage factory roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.factory_id = get_user_factory_id(auth.uid())
  ))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.factory_id = get_user_factory_id(auth.uid())
  ))
  OR is_super_admin(auth.uid())
);

-- Fix access_requests: scope admin view by factory
DROP POLICY IF EXISTS "Admins can view all requests" ON public.access_requests;
CREATE POLICY "Admins can view factory requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = access_requests.user_id
    AND p.factory_id = get_user_factory_id(auth.uid())
  )
);

-- Fix access_requests: scope admin update by factory
DROP POLICY IF EXISTS "Admins can update requests" ON public.access_requests;
CREATE POLICY "Admins can update factory requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = access_requests.user_id
    AND p.factory_id = get_user_factory_id(auth.uid())
  )
);

-- Fix access_requests: scope admin delete by factory
DROP POLICY IF EXISTS "Admins can delete requests" ON public.access_requests;
CREATE POLICY "Admins can delete factory requests"
ON public.access_requests
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = access_requests.user_id
    AND p.factory_id = get_user_factory_id(auth.uid())
  )
);

-- Fix invites: scope admin view to own invites
DROP POLICY IF EXISTS "Admins can view invites" ON public.invites;
CREATE POLICY "Admins can view own invites"
ON public.invites
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR is_super_admin(auth.uid())
);

-- Fix invites: scope admin create
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;
CREATE POLICY "Admins can create invites"
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid()
);
