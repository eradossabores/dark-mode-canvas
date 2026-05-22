-- Add vendedor_user_id to metas_vendas
ALTER TABLE public.metas_vendas ADD COLUMN vendedor_user_id UUID REFERENCES auth.users(id);

-- Add unique constraint for (factory_id, mes, vendedor_user_id)
-- Note: if vendedor_user_id is NULL, it represents the general factory goal.
-- PostgreSQL handles NULLs in unique constraints by allowing multiple NULLs by default, 
-- but we want one "global" goal per month per factory too.
-- Using a conditional unique index to handle this perfectly:

DROP INDEX IF EXISTS idx_metas_vendas_unique_global;
CREATE UNIQUE INDEX idx_metas_vendas_unique_global ON public.metas_vendas (factory_id, mes) WHERE vendedor_user_id IS NULL;

DROP INDEX IF EXISTS idx_metas_vendas_unique_vendedor;
CREATE UNIQUE INDEX idx_metas_vendas_unique_vendedor ON public.metas_vendas (factory_id, mes, vendedor_user_id) WHERE vendedor_user_id IS NOT NULL;
