
-- Tabela para registrar cada decisão do plano de produção (sugerido vs realizado)
CREATE TABLE public.decisoes_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dia_semana INTEGER NOT NULL, -- 0-6
  sabor_id UUID NOT NULL REFERENCES public.sabores(id),
  sabor_nome TEXT NOT NULL,
  estoque_no_momento INTEGER NOT NULL DEFAULT 0,
  vendas_7d INTEGER NOT NULL DEFAULT 0,
  media_diaria NUMERIC NOT NULL DEFAULT 0,
  dias_cobertura INTEGER NOT NULL DEFAULT 0,
  lotes_sugeridos INTEGER NOT NULL DEFAULT 0,
  lotes_autorizados INTEGER NOT NULL DEFAULT 0,
  ajuste INTEGER GENERATED ALWAYS AS (lotes_autorizados - lotes_sugeridos) STORED,
  operador TEXT NOT NULL DEFAULT 'sistema'
);

ALTER TABLE public.decisoes_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_decisoes" ON public.decisoes_producao
  FOR ALL USING (true) WITH CHECK (true);

-- Index para consultas de aprendizado por sabor e dia
CREATE INDEX idx_decisoes_sabor_dia ON public.decisoes_producao(sabor_id, dia_semana);
CREATE INDEX idx_decisoes_created ON public.decisoes_producao(created_at DESC);
