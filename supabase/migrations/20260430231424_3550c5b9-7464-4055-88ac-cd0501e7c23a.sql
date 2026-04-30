-- Recriar a política de INSERT com lógica explícita para vendedores
DROP POLICY IF EXISTS "Inserir cliente na própria fábrica" ON public.clientes;

CREATE POLICY "Inserir cliente na própria fábrica"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR factory_id = get_user_factory_id(auth.uid())
  OR (is_vendedor(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
);

-- Garantir que vendedores possam inserir vínculos cliente_vendedor para si mesmos
DROP POLICY IF EXISTS "Vendedor pode vincular a si mesmo" ON public.cliente_vendedor;

CREATE POLICY "Vendedor pode vincular a si mesmo"
ON public.cliente_vendedor
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR vendedor_user_id = auth.uid()
  OR (NOT is_vendedor(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
);