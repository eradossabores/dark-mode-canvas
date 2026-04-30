-- Atualiza a política de SELECT para incluir clientes AVULSO e AMOSTRAS para vendedores
DROP POLICY IF EXISTS "Acesso a clientes por vínculo ou fábrica" ON public.clientes;

CREATE POLICY "Acesso a clientes por vínculo ou fábrica"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR (
    (factory_id = get_user_factory_id(auth.uid())) AND (
      (NOT is_vendedor(auth.uid())) OR 
      cliente_pertence_ao_vendedor(id, auth.uid()) OR
      (nome IN ('AVULSO', 'AMOSTRAS'))
    )
  )
);

-- Atualiza a política de UPDATE para permitir que vendedores também atualizem ou vejam esses clientes se necessário (opcional, mas bom para consistência)
DROP POLICY IF EXISTS "Atualizar cliente da própria fábrica/vendedor" ON public.clientes;

CREATE POLICY "Atualizar cliente da própria fábrica/vendedor"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR (
    (factory_id = get_user_factory_id(auth.uid())) AND (
      (NOT is_vendedor(auth.uid())) OR 
      cliente_pertence_ao_vendedor(id, auth.uid()) OR
      (nome IN ('AVULSO', 'AMOSTRAS'))
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR (factory_id = get_user_factory_id(auth.uid()))
);
