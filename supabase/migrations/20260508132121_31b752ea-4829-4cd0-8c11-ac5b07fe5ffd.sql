ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS numero_lote TEXT,
  ADD COLUMN IF NOT EXISTS data_fabricacao DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

CREATE INDEX IF NOT EXISTS idx_compras_data_vencimento
  ON public.compras (factory_id, data_vencimento)
  WHERE data_vencimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compras_item_nome
  ON public.compras (factory_id, item_nome);