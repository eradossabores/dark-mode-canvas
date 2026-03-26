
-- Drop the old unique constraint on nome only
ALTER TABLE public.sabores DROP CONSTRAINT sabores_nome_key;

-- Add new unique constraint on (nome, factory_id) to support multi-tenant
ALTER TABLE public.sabores ADD CONSTRAINT sabores_nome_factory_unique UNIQUE (nome, factory_id);
