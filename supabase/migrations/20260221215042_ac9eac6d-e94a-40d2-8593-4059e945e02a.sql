
CREATE OR REPLACE FUNCTION public.realizar_producao(
  p_sabor_id uuid,
  p_modo modo_producao,
  p_quantidade_lotes integer,
  p_quantidade_total integer,
  p_operador text,
  p_observacoes text,
  p_funcionarios jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producao_id uuid;
  v_receita record;
  v_func jsonb;
BEGIN
  -- Buscar receita do sabor
  SELECT * INTO v_receita FROM sabor_receita WHERE sabor_id = p_sabor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receita não encontrada para este sabor';
  END IF;

  -- Validar estoque de matéria-prima
  DECLARE
    v_insumo_necessario numeric;
    v_estoque_mp numeric;
  BEGIN
    IF p_modo = 'lote' THEN
      v_insumo_necessario := v_receita.quantidade_insumo_por_lote * p_quantidade_lotes;
    ELSE
      v_insumo_necessario := (v_receita.quantidade_insumo_por_lote::numeric / v_receita.gelos_por_lote) * p_quantidade_total;
    END IF;

    SELECT estoque_atual INTO v_estoque_mp FROM materias_primas WHERE id = v_receita.materia_prima_id;
    IF v_estoque_mp < v_insumo_necessario THEN
      RAISE EXCEPTION 'Estoque insuficiente de matéria-prima. Necessário: %, Disponível: %', v_insumo_necessario, v_estoque_mp;
    END IF;

    -- Deduzir matéria-prima
    UPDATE materias_primas SET estoque_atual = estoque_atual - v_insumo_necessario WHERE id = v_receita.materia_prima_id;
  END;

  -- Validar e deduzir embalagens
  DECLARE
    v_emb_necessaria integer;
    v_estoque_emb integer;
  BEGIN
    IF p_modo = 'lote' THEN
      v_emb_necessaria := v_receita.embalagens_por_lote * p_quantidade_lotes;
    ELSE
      v_emb_necessaria := p_quantidade_total;
    END IF;

    SELECT estoque_atual INTO v_estoque_emb FROM embalagens WHERE id = v_receita.embalagem_id;
    IF v_estoque_emb < v_emb_necessaria THEN
      RAISE EXCEPTION 'Estoque insuficiente de embalagens. Necessário: %, Disponível: %', v_emb_necessaria, v_estoque_emb;
    END IF;

    UPDATE embalagens SET estoque_atual = estoque_atual - v_emb_necessaria WHERE id = v_receita.embalagem_id;
  END;

  -- Inserir produção
  INSERT INTO producoes (sabor_id, modo, quantidade_lotes, quantidade_total, operador, observacoes)
  VALUES (p_sabor_id, p_modo, p_quantidade_lotes, p_quantidade_total, p_operador, p_observacoes)
  RETURNING id INTO v_producao_id;

  -- Inserir funcionários responsáveis (sem validação de soma)
  FOR v_func IN SELECT * FROM jsonb_array_elements(p_funcionarios) LOOP
    INSERT INTO producao_funcionarios (producao_id, funcionario_id, quantidade_produzida)
    VALUES (
      v_producao_id,
      (v_func->>'funcionario_id')::uuid,
      COALESCE((v_func->>'quantidade_produzida')::integer, 0)
    );
  END LOOP;

  -- Atualizar estoque de gelos
  INSERT INTO estoque_gelos (sabor_id, quantidade)
  VALUES (p_sabor_id, p_quantidade_total)
  ON CONFLICT (sabor_id) DO UPDATE SET quantidade = estoque_gelos.quantidade + p_quantidade_total;

  -- Registrar movimentação
  INSERT INTO movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, operador, referencia, referencia_id)
  VALUES ('gelo_pronto', p_sabor_id, 'entrada', p_quantidade_total, p_operador, 'producao', v_producao_id);

  -- Auditoria
  INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao)
  VALUES ('producao', 'criar', p_operador, v_producao_id, 'Produção de ' || p_quantidade_total || ' unidades');

  RETURN v_producao_id;
END;
$$;
