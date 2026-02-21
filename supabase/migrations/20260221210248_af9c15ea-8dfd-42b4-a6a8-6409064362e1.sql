
-- Fix search_path for all functions
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.calcular_preco(
  p_cliente_id UUID,
  p_sabor_id UUID,
  p_quantidade INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_preco_sabor NUMERIC(10,2);
  v_preco_tabela NUMERIC(10,2);
  v_preco_padrao NUMERIC(10,2);
BEGIN
  SELECT preco_unitario INTO v_preco_sabor
  FROM public.cliente_preco_sabor
  WHERE cliente_id = p_cliente_id AND sabor_id = p_sabor_id;
  IF v_preco_sabor IS NOT NULL THEN RETURN v_preco_sabor; END IF;

  SELECT preco_unitario INTO v_preco_tabela
  FROM public.cliente_tabela_preco
  WHERE cliente_id = p_cliente_id AND quantidade_minima <= p_quantidade
  ORDER BY quantidade_minima DESC LIMIT 1;
  IF v_preco_tabela IS NOT NULL THEN RETURN v_preco_tabela; END IF;

  SELECT preco_padrao_personalizado INTO v_preco_padrao
  FROM public.clientes WHERE id = p_cliente_id;
  IF v_preco_padrao IS NOT NULL THEN RETURN v_preco_padrao; END IF;

  IF p_quantidade >= 100 THEN RETURN 1.99;
  ELSIF p_quantidade >= 30 THEN RETURN 2.50;
  ELSIF p_quantidade >= 10 THEN RETURN 3.99;
  END IF;

  RETURN 4.99;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.realizar_producao(
  p_sabor_id UUID,
  p_modo modo_producao,
  p_quantidade_lotes INTEGER,
  p_quantidade_total INTEGER,
  p_operador TEXT,
  p_observacoes TEXT,
  p_funcionarios JSONB
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
  SELECT * INTO v_receita FROM public.sabor_receita WHERE sabor_id = p_sabor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receita não encontrada para o sabor informado'; END IF;

  IF p_modo = 'lote' THEN
    v_insumo_necessario := v_receita.quantidade_insumo_por_lote * p_quantidade_lotes;
    v_embalagens_necessarias := v_receita.embalagens_por_lote * p_quantidade_lotes;
    IF p_quantidade_total != v_receita.gelos_por_lote * p_quantidade_lotes THEN
      RAISE EXCEPTION 'Quantidade total (%) diverge do esperado para % lote(s): %', p_quantidade_total, p_quantidade_lotes, v_receita.gelos_por_lote * p_quantidade_lotes;
    END IF;
  ELSE
    v_insumo_necessario := (v_receita.quantidade_insumo_por_lote::NUMERIC / v_receita.gelos_por_lote) * p_quantidade_total;
    v_embalagens_necessarias := p_quantidade_total;
  END IF;

  FOR v_func IN SELECT * FROM jsonb_array_elements(p_funcionarios) LOOP
    v_soma_funcionarios := v_soma_funcionarios + (v_func->>'quantidade_produzida')::INTEGER;
  END LOOP;
  IF v_soma_funcionarios != p_quantidade_total THEN
    RAISE EXCEPTION 'Soma dos funcionários (%) diverge do total produzido (%)', v_soma_funcionarios, p_quantidade_total;
  END IF;

  SELECT estoque_atual INTO v_estoque_mp FROM public.materias_primas WHERE id = v_receita.materia_prima_id FOR UPDATE;
  IF v_estoque_mp < v_insumo_necessario THEN
    RAISE EXCEPTION 'Estoque insuficiente de matéria-prima. Disponível: %, Necessário: %', v_estoque_mp, v_insumo_necessario;
  END IF;

  SELECT estoque_atual INTO v_estoque_emb FROM public.embalagens WHERE id = v_receita.embalagem_id FOR UPDATE;
  IF v_estoque_emb < v_embalagens_necessarias THEN
    RAISE EXCEPTION 'Estoque insuficiente de embalagens. Disponível: %, Necessário: %', v_estoque_emb, v_embalagens_necessarias;
  END IF;

  UPDATE public.materias_primas SET estoque_atual = estoque_atual - v_insumo_necessario WHERE id = v_receita.materia_prima_id;
  UPDATE public.embalagens SET estoque_atual = estoque_atual - v_embalagens_necessarias WHERE id = v_receita.embalagem_id;
  UPDATE public.estoque_gelos SET quantidade = quantidade + p_quantidade_total WHERE sabor_id = p_sabor_id;

  INSERT INTO public.producoes (sabor_id, modo, quantidade_lotes, quantidade_total, operador, observacoes)
  VALUES (p_sabor_id, p_modo, p_quantidade_lotes, p_quantidade_total, p_operador, p_observacoes)
  RETURNING id INTO v_producao_id;

  FOR v_func IN SELECT * FROM jsonb_array_elements(p_funcionarios) LOOP
    INSERT INTO public.producao_funcionarios (producao_id, funcionario_id, quantidade_produzida)
    VALUES (v_producao_id, (v_func->>'funcionario_id')::UUID, (v_func->>'quantidade_produzida')::INTEGER);
  END LOOP;

  INSERT INTO public.movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador) VALUES
    ('materia_prima', v_receita.materia_prima_id, 'saida', v_insumo_necessario, 'producao', v_producao_id, p_operador),
    ('embalagem', v_receita.embalagem_id, 'saida', v_embalagens_necessarias, 'producao', v_producao_id, p_operador),
    ('gelo_pronto', p_sabor_id, 'entrada', p_quantidade_total, 'producao', v_producao_id, p_operador);

  INSERT INTO public.auditoria (usuario_nome, modulo, acao, registro_afetado, descricao)
  VALUES (p_operador, 'producao', 'criar', v_producao_id,
    format('Produção de %s unidades do sabor %s', p_quantidade_total, (SELECT nome FROM public.sabores WHERE id = p_sabor_id)));

  RETURN v_producao_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_cliente_id UUID,
  p_operador TEXT,
  p_observacoes TEXT,
  p_itens JSONB,
  p_parcelas JSONB DEFAULT NULL
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
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = p_cliente_id AND status = 'ativo';
  IF v_cliente_nome IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado ou inativo'; END IF;

  INSERT INTO public.vendas (cliente_id, total, operador, observacoes)
  VALUES (p_cliente_id, 0, p_operador, p_observacoes) RETURNING id INTO v_venda_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_sabor_id := (v_item->>'sabor_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INTEGER;

    SELECT quantidade INTO v_estoque FROM public.estoque_gelos WHERE sabor_id = v_sabor_id FOR UPDATE;
    IF v_estoque IS NULL OR v_estoque < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para sabor %. Disponível: %, Solicitado: %',
        (SELECT nome FROM public.sabores WHERE id = v_sabor_id), COALESCE(v_estoque, 0), v_quantidade;
    END IF;

    v_preco := public.calcular_preco(p_cliente_id, v_sabor_id, v_quantidade);
    v_subtotal := v_preco * v_quantidade;
    v_total := v_total + v_subtotal;

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

    INSERT INTO public.venda_itens (venda_id, sabor_id, quantidade, preco_unitario, subtotal, regra_preco_aplicada)
    VALUES (v_venda_id, v_sabor_id, v_quantidade, v_preco, v_subtotal, v_regra);

    UPDATE public.estoque_gelos SET quantidade = quantidade - v_quantidade WHERE sabor_id = v_sabor_id;

    INSERT INTO public.movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador)
    VALUES ('gelo_pronto', v_sabor_id, 'saida', v_quantidade, 'venda', v_venda_id, p_operador);
  END LOOP;

  UPDATE public.vendas SET total = v_total WHERE id = v_venda_id;
  UPDATE public.clientes SET ultima_compra = now() WHERE id = p_cliente_id;

  IF p_parcelas IS NOT NULL THEN
    FOR v_parcela IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
      v_num_parcela := v_num_parcela + 1;
      INSERT INTO public.venda_parcelas (venda_id, numero, valor, vencimento)
      VALUES (v_venda_id, v_num_parcela, (v_parcela->>'valor')::NUMERIC, (v_parcela->>'vencimento')::DATE);
    END LOOP;
  END IF;

  INSERT INTO public.auditoria (usuario_nome, modulo, acao, registro_afetado, descricao)
  VALUES (p_operador, 'vendas', 'criar', v_venda_id,
    format('Venda de R$ %s para cliente %s', v_total, v_cliente_nome));

  RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;
