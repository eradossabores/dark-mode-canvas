-- First, remove the old constraint that only allowed one goal per month for the entire factory
ALTER TABLE public.metas_vendas DROP CONSTRAINT IF EXISTS metas_vendas_factory_id_mes_key;

-- Add a new unique constraint that includes the seller ID
-- We use COALESCE to handle nulls in the unique index if needed, 
-- but a standard UNIQUE constraint on multiple columns usually handles one NULL as unique.
-- To be safe and explicit for tracking global vs individual goals:
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_vendas_factory_mes_vendedor 
ON public.metas_vendas (factory_id, mes, (COALESCE(vendedor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)));
