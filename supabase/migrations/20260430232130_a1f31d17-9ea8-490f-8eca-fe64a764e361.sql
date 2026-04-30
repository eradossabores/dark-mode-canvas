-- Remover política restritiva anterior
DROP POLICY IF EXISTS "Apagar cliente apenas admins/donos" ON public.clientes;

-- Criar nova política que permite exclusão por vendedores (donos/criadores)
CREATE POLICY "Permitir exclusão de clientes por admins ou criadores" 
ON public.clientes 
FOR DELETE 
USING (
  is_super_admin(auth.uid()) OR 
  (
    factory_id = get_user_factory_id(auth.uid()) AND 
    (
      (NOT is_vendedor(auth.uid())) OR 
      (created_by = auth.uid()) OR 
      cliente_pertence_ao_vendedor(id, auth.uid())
    )
  )
);