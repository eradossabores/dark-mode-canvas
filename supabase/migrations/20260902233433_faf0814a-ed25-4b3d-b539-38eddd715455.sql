ALTER TABLE public.bebidas
  ADD COLUMN IF NOT EXISTS preco_fardo numeric,
  ADD COLUMN IF NOT EXISTS unidades_fardo integer NOT NULL DEFAULT 6;

ALTER TABLE public.venda_bebida_itens
  ADD COLUMN IF NOT EXISTS tipo_venda text NOT NULL DEFAULT 'unidade';

ALTER TABLE public.venda_bebida_itens
  DROP CONSTRAINT IF EXISTS venda_bebida_itens_tipo_venda_check;

ALTER TABLE public.venda_bebida_itens
  ADD CONSTRAINT venda_bebida_itens_tipo_venda_check CHECK (tipo_venda IN ('unidade','fardo'));