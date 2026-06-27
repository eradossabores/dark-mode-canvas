ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS data_prevista_chegada DATE,
  ADD COLUMN IF NOT EXISTS transportadora TEXT;