-- Adicionar coluna created_by se não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'created_by') THEN
    ALTER TABLE public.clientes ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid();
  END IF;
END $$;

-- Atualizar política de INSERT em clientes
DROP POLICY IF EXISTS "Inserir cliente na própria fábrica" ON public.clientes;
CREATE POLICY "Inserir cliente na própria fábrica"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR factory_id = get_user_factory_id(auth.uid())
);

-- Atualizar política de SELECT em clientes para permitir ver o que acabou de criar
DROP POLICY IF EXISTS "Acesso a clientes por vínculo ou fábrica" ON public.clientes;
CREATE POLICY "Acesso a clientes por vínculo ou fábrica"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    factory_id = get_user_factory_id(auth.uid()) 
    AND (
      NOT is_vendedor(auth.uid()) 
      OR created_by = auth.uid() 
      OR cliente_pertence_ao_vendedor(id, auth.uid()) 
      OR (nome = ANY (ARRAY['AVULSO', 'AMOSTRAS']))
    )
  )
);

-- Garantir que vendedores possam atualizar seus próprios clientes
DROP POLICY IF EXISTS "Atualizar cliente da própria fábrica/vendedor" ON public.clientes;
CREATE POLICY "Atualizar cliente da própria fábrica/vendedor"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    factory_id = get_user_factory_id(auth.uid()) 
    AND (
      NOT is_vendedor(auth.uid()) 
      OR created_by = auth.uid()
      OR cliente_pertence_ao_vendedor(id, auth.uid()) 
      OR (nome = ANY (ARRAY['AVULSO', 'AMOSTRAS']))
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR factory_id = get_user_factory_id(auth.uid())
);