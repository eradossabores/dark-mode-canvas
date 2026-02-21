
-- ============================================
-- ERP "A Era dos Sabores" - Schema Completo
-- ============================================

-- ENUM types
CREATE TYPE unidade_medida AS ENUM ('g', 'kg');
CREATE TYPE tipo_pagamento_funcionario AS ENUM ('diaria', 'fixo');
CREATE TYPE tipo_movimentacao AS ENUM ('entrada', 'saida');
CREATE TYPE tipo_item_estoque AS ENUM ('materia_prima', 'gelo_pronto', 'embalagem');
CREATE TYPE status_cliente AS ENUM ('ativo', 'inativo');
CREATE TYPE status_venda AS ENUM ('pendente', 'paga', 'cancelada');
CREATE TYPE modo_producao AS ENUM ('unidade', 'lote');

-- ============================================
-- 1. SABORES
-- ============================================
CREATE TABLE public.sabores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. MATÉRIA-PRIMA
-- ============================================
CREATE TABLE public.materias_primas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  unidade unidade_medida NOT NULL DEFAULT 'g',
  estoque_atual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
  estoque_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. EMBALAGENS
-- ============================================
CREATE TABLE public.embalagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  estoque_atual INTEGER NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. RECEITA DO SABOR (insumo + embalagem por sabor)
-- ============================================
CREATE TABLE public.sabor_receita (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES public.materias_primas(id) ON DELETE RESTRICT,
  embalagem_id UUID NOT NULL REFERENCES public.embalagens(id) ON DELETE RESTRICT,
  quantidade_insumo_por_lote NUMERIC(10,2) NOT NULL DEFAULT 400,
  gelos_por_lote INTEGER NOT NULL DEFAULT 84,
  embalagens_por_lote INTEGER NOT NULL DEFAULT 84,
  UNIQUE(sabor_id)
);

-- ============================================
-- 5. ESTOQUE DE GELOS PRONTOS
-- ============================================
CREATE TABLE public.estoque_gelos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE RESTRICT UNIQUE,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. FUNCIONÁRIOS
-- ============================================
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_pagamento tipo_pagamento_funcionario NOT NULL DEFAULT 'diaria',
  valor_pagamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 7. CLIENTES
-- ============================================
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT DEFAULT 'SP',
  cep TEXT,
  cpf_cnpj TEXT UNIQUE,
  status status_cliente NOT NULL DEFAULT 'ativo',
  possui_freezer BOOLEAN NOT NULL DEFAULT false,
  freezer_identificacao TEXT,
  preco_padrao_personalizado NUMERIC(10,2),
  observacoes TEXT,
  ultima_compra TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 8. TABELA PROGRESSIVA PERSONALIZADA POR CLIENTE
-- ============================================
CREATE TABLE public.cliente_tabela_preco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  quantidade_minima INTEGER NOT NULL CHECK (quantidade_minima > 0),
  preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario > 0),
  UNIQUE(cliente_id, quantidade_minima)
);

-- ============================================
-- 9. PREÇO PERSONALIZADO POR SABOR POR CLIENTE
-- ============================================
CREATE TABLE public.cliente_preco_sabor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE CASCADE,
  preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario > 0),
  UNIQUE(cliente_id, sabor_id)
);

-- ============================================
-- 10. ESTOQUE EM FREEZER POR CLIENTE
-- ============================================
CREATE TABLE public.estoque_freezer (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, sabor_id)
);

-- ============================================
-- 11. PRODUÇÃO
-- ============================================
CREATE TABLE public.producoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE RESTRICT,
  modo modo_producao NOT NULL DEFAULT 'lote',
  quantidade_lotes INTEGER NOT NULL DEFAULT 1,
  quantidade_total INTEGER NOT NULL,
  operador TEXT NOT NULL DEFAULT 'sistema',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 12. PRODUÇÃO POR FUNCIONÁRIO
-- ============================================
CREATE TABLE public.producao_funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producao_id UUID NOT NULL REFERENCES public.producoes(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  quantidade_produzida INTEGER NOT NULL CHECK (quantidade_produzida > 0)
);

-- ============================================
-- 13. VENDAS
-- ============================================
CREATE TABLE public.vendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status status_venda NOT NULL DEFAULT 'pendente',
  operador TEXT NOT NULL DEFAULT 'sistema',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 14. ITENS DA VENDA
-- ============================================
CREATE TABLE public.venda_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  regra_preco_aplicada TEXT NOT NULL DEFAULT 'padrao'
);

-- ============================================
-- 15. PARCELAS
-- ============================================
CREATE TABLE public.venda_parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  vencimento DATE NOT NULL,
  paga BOOLEAN NOT NULL DEFAULT false,
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 16. MOVIMENTAÇÕES DE ESTOQUE
-- ============================================
CREATE TABLE public.movimentacoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_item tipo_item_estoque NOT NULL,
  item_id UUID NOT NULL,
  tipo_movimentacao tipo_movimentacao NOT NULL,
  quantidade NUMERIC(12,2) NOT NULL,
  referencia TEXT,
  referencia_id UUID,
  operador TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 17. AUDITORIA
-- ============================================
CREATE TABLE public.auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_nome TEXT NOT NULL DEFAULT 'sistema',
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  registro_afetado UUID,
  descricao TEXT,
  dispositivo TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_vendas_cliente ON public.vendas(cliente_id);
CREATE INDEX idx_vendas_status ON public.vendas(status);
CREATE INDEX idx_vendas_created ON public.vendas(created_at);
CREATE INDEX idx_venda_itens_venda ON public.venda_itens(venda_id);
CREATE INDEX idx_venda_itens_sabor ON public.venda_itens(sabor_id);
CREATE INDEX idx_producoes_sabor ON public.producoes(sabor_id);
CREATE INDEX idx_producoes_created ON public.producoes(created_at);
CREATE INDEX idx_movimentacoes_tipo ON public.movimentacoes_estoque(tipo_item, item_id);
CREATE INDEX idx_movimentacoes_ref ON public.movimentacoes_estoque(referencia, referencia_id);
CREATE INDEX idx_movimentacoes_created ON public.movimentacoes_estoque(created_at);
CREATE INDEX idx_auditoria_modulo ON public.auditoria(modulo);
CREATE INDEX idx_auditoria_created ON public.auditoria(created_at);
CREATE INDEX idx_clientes_status ON public.clientes(status);
CREATE INDEX idx_estoque_freezer_cliente ON public.estoque_freezer(cliente_id);
CREATE INDEX idx_cliente_tabela_preco_cliente ON public.cliente_tabela_preco(cliente_id);
CREATE INDEX idx_cliente_preco_sabor_cliente ON public.cliente_preco_sabor(cliente_id);

-- ============================================
-- TRIGGER updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_sabores BEFORE UPDATE ON public.sabores FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_materias_primas BEFORE UPDATE ON public.materias_primas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_embalagens BEFORE UPDATE ON public.embalagens FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_estoque_gelos BEFORE UPDATE ON public.estoque_gelos FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_funcionarios BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_clientes BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_vendas BEFORE UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_estoque_freezer BEFORE UPDATE ON public.estoque_freezer FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ============================================
-- DESABILITAR RLS (sem autenticação conforme requisito)
-- ============================================
ALTER TABLE public.sabores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embalagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sabor_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_gelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_tabela_preco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_preco_sabor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_freezer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (sem auth conforme requisito)
CREATE POLICY "allow_all" ON public.sabores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.materias_primas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.embalagens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.sabor_receita FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.estoque_gelos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.funcionarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.cliente_tabela_preco FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.cliente_preco_sabor FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.estoque_freezer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.producoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.producao_funcionarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.venda_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.venda_parcelas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.movimentacoes_estoque FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.auditoria FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque_gelos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.producoes;

-- ============================================
-- DADOS INICIAIS: SABORES + MATÉRIAS-PRIMAS + EMBALAGENS + RECEITAS + ESTOQUE
-- ============================================

-- Inserir matérias-primas (saborizantes)
INSERT INTO public.materias_primas (id, nome, unidade, estoque_atual) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Saborizante Melancia', 'g', 0),
  ('a0000001-0000-0000-0000-000000000002', 'Saborizante Maçã Verde', 'g', 0),
  ('a0000001-0000-0000-0000-000000000003', 'Saborizante Água de Coco', 'g', 0),
  ('a0000001-0000-0000-0000-000000000004', 'Saborizante Maracujá', 'g', 0),
  ('a0000001-0000-0000-0000-000000000005', 'Saborizante Morango', 'g', 0),
  ('a0000001-0000-0000-0000-000000000006', 'Saborizante Bob Marley', 'g', 0),
  ('a0000001-0000-0000-0000-000000000007', 'Saborizante Abacaxi com Hortelã', 'g', 0),
  ('a0000001-0000-0000-0000-000000000008', 'Saborizante Limão', 'g', 0),
  ('a0000001-0000-0000-0000-000000000009', 'Saborizante Limão com Sal', 'g', 0),
  ('a0000001-0000-0000-0000-000000000010', 'Saborizante Pitaya', 'g', 0),
  ('a0000001-0000-0000-0000-000000000011', 'Saborizante Blue Ice', 'g', 0);

-- Inserir embalagens
INSERT INTO public.embalagens (id, nome, estoque_atual) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Embalagem Melancia', 0),
  ('b0000001-0000-0000-0000-000000000002', 'Embalagem Maçã Verde', 0),
  ('b0000001-0000-0000-0000-000000000003', 'Embalagem Água de Coco', 0),
  ('b0000001-0000-0000-0000-000000000004', 'Embalagem Maracujá', 0),
  ('b0000001-0000-0000-0000-000000000005', 'Embalagem Morango', 0),
  ('b0000001-0000-0000-0000-000000000006', 'Embalagem Bob Marley', 0),
  ('b0000001-0000-0000-0000-000000000007', 'Embalagem Abacaxi com Hortelã', 0),
  ('b0000001-0000-0000-0000-000000000008', 'Embalagem Limão', 0),
  ('b0000001-0000-0000-0000-000000000009', 'Embalagem Limão com Sal', 0),
  ('b0000001-0000-0000-0000-000000000010', 'Embalagem Pitaya', 0),
  ('b0000001-0000-0000-0000-000000000011', 'Embalagem Blue Ice', 0);

-- Inserir sabores
INSERT INTO public.sabores (id, nome) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Melancia'),
  ('c0000001-0000-0000-0000-000000000002', 'Maçã Verde'),
  ('c0000001-0000-0000-0000-000000000003', 'Água de Coco'),
  ('c0000001-0000-0000-0000-000000000004', 'Maracujá'),
  ('c0000001-0000-0000-0000-000000000005', 'Morango'),
  ('c0000001-0000-0000-0000-000000000006', 'Bob Marley'),
  ('c0000001-0000-0000-0000-000000000007', 'Abacaxi com Hortelã'),
  ('c0000001-0000-0000-0000-000000000008', 'Limão'),
  ('c0000001-0000-0000-0000-000000000009', 'Limão com Sal'),
  ('c0000001-0000-0000-0000-000000000010', 'Pitaya'),
  ('c0000001-0000-0000-0000-000000000011', 'Blue Ice');

-- Inserir receitas (Água de Coco = 500g, resto = 400g)
INSERT INTO public.sabor_receita (sabor_id, materia_prima_id, embalagem_id, quantidade_insumo_por_lote) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 400),
  ('c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000002', 400),
  ('c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000003', 500),
  ('c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000004', 400),
  ('c0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000005', 400),
  ('c0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000006', 'b0000001-0000-0000-0000-000000000006', 400),
  ('c0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000007', 'b0000001-0000-0000-0000-000000000007', 400),
  ('c0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000008', 'b0000001-0000-0000-0000-000000000008', 400),
  ('c0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000009', 'b0000001-0000-0000-0000-000000000009', 400),
  ('c0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000010', 'b0000001-0000-0000-0000-000000000010', 400),
  ('c0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000011', 'b0000001-0000-0000-0000-000000000011', 400);

-- Inserir estoque de gelos (inicialmente zero)
INSERT INTO public.estoque_gelos (sabor_id, quantidade) VALUES
  ('c0000001-0000-0000-0000-000000000001', 0),
  ('c0000001-0000-0000-0000-000000000002', 0),
  ('c0000001-0000-0000-0000-000000000003', 0),
  ('c0000001-0000-0000-0000-000000000004', 0),
  ('c0000001-0000-0000-0000-000000000005', 0),
  ('c0000001-0000-0000-0000-000000000006', 0),
  ('c0000001-0000-0000-0000-000000000007', 0),
  ('c0000001-0000-0000-0000-000000000008', 0),
  ('c0000001-0000-0000-0000-000000000009', 0),
  ('c0000001-0000-0000-0000-000000000010', 0),
  ('c0000001-0000-0000-0000-000000000011', 0);

-- ============================================
-- FUNÇÕES DE NEGÓCIO NO BANCO (para transactions)
-- ============================================

-- Função de cálculo de preço (hierarquia completa)
CREATE OR REPLACE FUNCTION public.calcular_preco(
  p_cliente_id UUID,
  p_sabor_id UUID,
  p_quantidade INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_preco NUMERIC(10,2);
  v_preco_sabor NUMERIC(10,2);
  v_preco_tabela NUMERIC(10,2);
  v_preco_padrao NUMERIC(10,2);
  v_preco_tabela_padrao NUMERIC(10,2);
BEGIN
  -- 1. Preço personalizado por sabor
  SELECT preco_unitario INTO v_preco_sabor
  FROM public.cliente_preco_sabor
  WHERE cliente_id = p_cliente_id AND sabor_id = p_sabor_id;
  
  IF v_preco_sabor IS NOT NULL THEN
    RETURN v_preco_sabor;
  END IF;

  -- 2. Tabela progressiva personalizada
  SELECT preco_unitario INTO v_preco_tabela
  FROM public.cliente_tabela_preco
  WHERE cliente_id = p_cliente_id AND quantidade_minima <= p_quantidade
  ORDER BY quantidade_minima DESC
  LIMIT 1;
  
  IF v_preco_tabela IS NOT NULL THEN
    RETURN v_preco_tabela;
  END IF;

  -- 3. Preço padrão personalizado
  SELECT preco_padrao_personalizado INTO v_preco_padrao
  FROM public.clientes
  WHERE id = p_cliente_id;
  
  IF v_preco_padrao IS NOT NULL THEN
    RETURN v_preco_padrao;
  END IF;

  -- 4. Tabela progressiva padrão
  IF p_quantidade >= 100 THEN RETURN 1.99;
  ELSIF p_quantidade >= 30 THEN RETURN 2.50;
  ELSIF p_quantidade >= 10 THEN RETURN 3.99;
  END IF;

  -- 5. Preço base
  RETURN 4.99;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função de produção com transaction
CREATE OR REPLACE FUNCTION public.realizar_producao(
  p_sabor_id UUID,
  p_modo modo_producao,
  p_quantidade_lotes INTEGER,
  p_quantidade_total INTEGER,
  p_operador TEXT,
  p_observacoes TEXT,
  p_funcionarios JSONB -- [{"funcionario_id": "uuid", "quantidade_produzida": 10}, ...]
) RETURNS UUID AS $$
DECLARE
  v_receita RECORD;
  v_insumo_necessario NUMERIC;
  v_embalagens_necessarias INTEGER;
  v_producao_id UUID;
  v_func JSONB;
  v_soma_funcionarios INTEGER := 0;
  v_estoque_mp NUMERIC;
  v_estoque_emb INTEGER;
BEGIN
  -- Buscar receita
  SELECT * INTO v_receita FROM public.sabor_receita WHERE sabor_id = p_sabor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receita não encontrada para o sabor informado';
  END IF;

  -- Calcular necessidades
  IF p_modo = 'lote' THEN
    v_insumo_necessario := v_receita.quantidade_insumo_por_lote * p_quantidade_lotes;
    v_embalagens_necessarias := v_receita.embalagens_por_lote * p_quantidade_lotes;
    -- Validar quantidade total = lotes * gelos_por_lote
    IF p_quantidade_total != v_receita.gelos_por_lote * p_quantidade_lotes THEN
      RAISE EXCEPTION 'Quantidade total (%) diverge do esperado para % lote(s): %',
        p_quantidade_total, p_quantidade_lotes, v_receita.gelos_por_lote * p_quantidade_lotes;
    END IF;
  ELSE
    -- Modo unidade: calcular proporcionalmente
    v_insumo_necessario := (v_receita.quantidade_insumo_por_lote::NUMERIC / v_receita.gelos_por_lote) * p_quantidade_total;
    v_embalagens_necessarias := p_quantidade_total;
  END IF;

  -- Validar soma dos funcionários
  FOR v_func IN SELECT * FROM jsonb_array_elements(p_funcionarios)
  LOOP
    v_soma_funcionarios := v_soma_funcionarios + (v_func->>'quantidade_produzida')::INTEGER;
  END LOOP;

  IF v_soma_funcionarios != p_quantidade_total THEN
    RAISE EXCEPTION 'Soma dos funcionários (%) diverge do total produzido (%)',
      v_soma_funcionarios, p_quantidade_total;
  END IF;

  -- Verificar estoque matéria-prima
  SELECT estoque_atual INTO v_estoque_mp FROM public.materias_primas WHERE id = v_receita.materia_prima_id FOR UPDATE;
  IF v_estoque_mp < v_insumo_necessario THEN
    RAISE EXCEPTION 'Estoque insuficiente de matéria-prima. Disponível: %, Necessário: %', v_estoque_mp, v_insumo_necessario;
  END IF;

  -- Verificar estoque embalagens
  SELECT estoque_atual INTO v_estoque_emb FROM public.embalagens WHERE id = v_receita.embalagem_id FOR UPDATE;
  IF v_estoque_emb < v_embalagens_necessarias THEN
    RAISE EXCEPTION 'Estoque insuficiente de embalagens. Disponível: %, Necessário: %', v_estoque_emb, v_embalagens_necessarias;
  END IF;

  -- Subtrair matéria-prima
  UPDATE public.materias_primas SET estoque_atual = estoque_atual - v_insumo_necessario WHERE id = v_receita.materia_prima_id;

  -- Subtrair embalagens
  UPDATE public.embalagens SET estoque_atual = estoque_atual - v_embalagens_necessarias WHERE id = v_receita.embalagem_id;

  -- Adicionar gelos ao estoque
  UPDATE public.estoque_gelos SET quantidade = quantidade + p_quantidade_total WHERE sabor_id = p_sabor_id;

  -- Registrar produção
  INSERT INTO public.producoes (sabor_id, modo, quantidade_lotes, quantidade_total, operador, observacoes)
  VALUES (p_sabor_id, p_modo, p_quantidade_lotes, p_quantidade_total, p_operador, p_observacoes)
  RETURNING id INTO v_producao_id;

  -- Registrar funcionários
  FOR v_func IN SELECT * FROM jsonb_array_elements(p_funcionarios)
  LOOP
    INSERT INTO public.producao_funcionarios (producao_id, funcionario_id, quantidade_produzida)
    VALUES (v_producao_id, (v_func->>'funcionario_id')::UUID, (v_func->>'quantidade_produzida')::INTEGER);
  END LOOP;

  -- Movimentações
  INSERT INTO public.movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador)
  VALUES 
    ('materia_prima', v_receita.materia_prima_id, 'saida', v_insumo_necessario, 'producao', v_producao_id, p_operador),
    ('embalagem', v_receita.embalagem_id, 'saida', v_embalagens_necessarias, 'producao', v_producao_id, p_operador),
    ('gelo_pronto', p_sabor_id, 'entrada', p_quantidade_total, 'producao', v_producao_id, p_operador);

  -- Auditoria
  INSERT INTO public.auditoria (usuario_nome, modulo, acao, registro_afetado, descricao)
  VALUES (p_operador, 'producao', 'criar', v_producao_id, 
    format('Produção de %s unidades do sabor %s', p_quantidade_total, (SELECT nome FROM public.sabores WHERE id = p_sabor_id)));

  RETURN v_producao_id;
END;
$$ LANGUAGE plpgsql;

-- Função de venda com transaction
CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_cliente_id UUID,
  p_operador TEXT,
  p_observacoes TEXT,
  p_itens JSONB, -- [{"sabor_id": "uuid", "quantidade": 10}, ...]
  p_parcelas JSONB DEFAULT NULL -- [{"valor": 10.00, "vencimento": "2025-01-01"}, ...]
) RETURNS UUID AS $$
DECLARE
  v_venda_id UUID;
  v_item JSONB;
  v_sabor_id UUID;
  v_quantidade INTEGER;
  v_preco NUMERIC(10,2);
  v_subtotal NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_estoque INTEGER;
  v_regra TEXT;
  v_parcela JSONB;
  v_num_parcela INTEGER := 0;
  v_cliente_nome TEXT;
BEGIN
  -- Validar cliente
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = p_cliente_id AND status = 'ativo';
  IF v_cliente_nome IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou inativo';
  END IF;

  -- Criar venda
  INSERT INTO public.vendas (cliente_id, total, operador, observacoes)
  VALUES (p_cliente_id, 0, p_operador, p_observacoes)
  RETURNING id INTO v_venda_id;

  -- Processar itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_sabor_id := (v_item->>'sabor_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INTEGER;

    -- Verificar estoque com lock
    SELECT quantidade INTO v_estoque FROM public.estoque_gelos WHERE sabor_id = v_sabor_id FOR UPDATE;
    IF v_estoque IS NULL OR v_estoque < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para sabor %. Disponível: %, Solicitado: %',
        (SELECT nome FROM public.sabores WHERE id = v_sabor_id), COALESCE(v_estoque, 0), v_quantidade;
    END IF;

    -- Calcular preço via hierarquia
    v_preco := public.calcular_preco(p_cliente_id, v_sabor_id, v_quantidade);
    v_subtotal := v_preco * v_quantidade;
    v_total := v_total + v_subtotal;

    -- Determinar regra aplicada
    IF EXISTS (SELECT 1 FROM public.cliente_preco_sabor WHERE cliente_id = p_cliente_id AND sabor_id = v_sabor_id) THEN
      v_regra := 'preco_sabor_personalizado';
    ELSIF EXISTS (SELECT 1 FROM public.cliente_tabela_preco WHERE cliente_id = p_cliente_id AND quantidade_minima <= v_quantidade) THEN
      v_regra := 'tabela_progressiva_personalizada';
    ELSIF (SELECT preco_padrao_personalizado FROM public.clientes WHERE id = p_cliente_id) IS NOT NULL THEN
      v_regra := 'preco_padrao_personalizado';
    ELSIF v_quantidade >= 10 THEN
      v_regra := 'tabela_progressiva_padrao';
    ELSE
      v_regra := 'preco_base';
    END IF;

    -- Inserir item
    INSERT INTO public.venda_itens (venda_id, sabor_id, quantidade, preco_unitario, subtotal, regra_preco_aplicada)
    VALUES (v_venda_id, v_sabor_id, v_quantidade, v_preco, v_subtotal, v_regra);

    -- Subtrair estoque
    UPDATE public.estoque_gelos SET quantidade = quantidade - v_quantidade WHERE sabor_id = v_sabor_id;

    -- Movimentação
    INSERT INTO public.movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador)
    VALUES ('gelo_pronto', v_sabor_id, 'saida', v_quantidade, 'venda', v_venda_id, p_operador);
  END LOOP;

  -- Atualizar total
  UPDATE public.vendas SET total = v_total WHERE id = v_venda_id;

  -- Atualizar última compra do cliente
  UPDATE public.clientes SET ultima_compra = now() WHERE id = p_cliente_id;

  -- Parcelas
  IF p_parcelas IS NOT NULL THEN
    FOR v_parcela IN SELECT * FROM jsonb_array_elements(p_parcelas)
    LOOP
      v_num_parcela := v_num_parcela + 1;
      INSERT INTO public.venda_parcelas (venda_id, numero, valor, vencimento)
      VALUES (v_venda_id, v_num_parcela, (v_parcela->>'valor')::NUMERIC, (v_parcela->>'vencimento')::DATE);
    END LOOP;
  END IF;

  -- Auditoria
  INSERT INTO public.auditoria (usuario_nome, modulo, acao, registro_afetado, descricao)
  VALUES (p_operador, 'vendas', 'criar', v_venda_id,
    format('Venda de R$ %s para cliente %s', v_total, v_cliente_nome));

  RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql;
