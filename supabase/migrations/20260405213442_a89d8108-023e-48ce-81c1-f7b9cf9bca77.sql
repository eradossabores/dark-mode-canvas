
ALTER TABLE public.vendas
  ADD COLUMN valor_frete numeric NOT NULL DEFAULT 0,
  ADD COLUMN frete_pago_por text NOT NULL DEFAULT 'cliente';
