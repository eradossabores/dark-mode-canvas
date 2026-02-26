
-- Tabela de contas a pagar
CREATE TABLE public.contas_a_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  responsavel TEXT,
  valor_parcela NUMERIC(10,2) NOT NULL DEFAULT 0,
  parcela_atual INTEGER DEFAULT 0,
  total_parcelas INTEGER DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'parcelado' CHECK (tipo IN ('fixo', 'parcelado')),
  valor_total NUMERIC(12,2) DEFAULT 0,
  valor_restante NUMERIC(12,2) DEFAULT 0,
  mes_referencia TEXT DEFAULT 'marco',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can do everything
CREATE POLICY "Authenticated users full access" ON public.contas_a_pagar
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Seed data from the user's spreadsheet (Março)
INSERT INTO public.contas_a_pagar (descricao, responsavel, valor_parcela, parcela_atual, total_parcelas, tipo, valor_total, valor_restante, mes_referencia) VALUES
  ('ESSENCIA', 'André', 576.30, 7, 12, 'parcelado', 6915.60, 3457.80, 'marco'),
  ('SELADORA', 'André', 389.13, 7, 12, 'parcelado', 4669.56, 2334.78, 'marco'),
  ('SELADORA 1', 'Lourdete', 299.25, 10, 12, 'parcelado', 3591.00, 897.75, 'marco'),
  ('FREEZER', 'Lourdete', 279.90, 7, 10, 'parcelado', 2799.00, 1399.50, 'marco'),
  ('CONTADORA', NULL, 200.00, 0, 0, 'fixo', 0, 0, 'marco'),
  ('ANDRÉ', 'André', 4200.00, 2, 2, 'parcelado', 9000.00, 4500.00, 'marco'),
  ('DAS', NULL, 84.00, 0, 0, 'fixo', 0, 0, 'marco'),
  ('CELULAR', NULL, 45.00, 0, 0, 'fixo', 0, 0, 'marco'),
  ('FREEZER', 'André', 250.00, 1, 5, 'parcelado', 1250.00, 1000.00, 'marco'),
  ('FREEZER', 'André', 269.90, 2, 10, 'parcelado', 2699.00, 2159.20, 'marco');
