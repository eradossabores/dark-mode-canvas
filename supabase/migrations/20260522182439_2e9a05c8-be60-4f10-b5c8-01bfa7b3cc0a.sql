ALTER TABLE public.compras ADD COLUMN unidade TEXT;

-- Update existing records
UPDATE public.compras SET unidade = 'g' WHERE tipo = 'insumo' AND unidade IS NULL;
UPDATE public.compras SET unidade = 'unid' WHERE tipo = 'embalagem' AND unidade IS NULL;