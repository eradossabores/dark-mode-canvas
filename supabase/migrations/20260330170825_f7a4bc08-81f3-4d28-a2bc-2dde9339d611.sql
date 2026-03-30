-- Remove unique constraint on sabor_id to allow multiple ingredients per flavor
ALTER TABLE public.sabor_receita DROP CONSTRAINT sabor_receita_sabor_id_key;

-- Update realizar_producao to handle multiple ingredients per sabor
CREATE OR REPLACE FUNCTION public.realizar_producao(
  p_sabor_id uuid,
  p_modo modo_producao,
  p_quantidade_lotes integer,
  p_quantidade_total integer,
  p_operador text,
  p_observacoes text,
  p_funcionarios jsonb,
  p_ignorar_estoque boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_producao_id uuid;
  v_receita record;
  v_func jsonb;
  v_factory_id uuid;
  v_has_receita boolean := false;
  v_gelos_por_lote integer;
  v_embalagem_id uuid;
  v_embalagens_por_lote integer;
BEGIN
  -- Extract factory_id from the sabor
  SELECT factory_id INTO v_factory_id FROM sabores WHERE id = p_sabor_id;

  -- Get gelos_por_lote and embalagem info from the first recipe row
  SELECT gelos_por_lote, embalagem_id, embalagens_por_lote
  INTO v_gelos_por_lote, v_embalagem_id, v_embalagens_por_lote
  FROM sabor_receita WHERE sabor_id = p_sabor_id LIMIT 1;

  IF v_gelos_por_lote IS NULL THEN
    RAISE EXCEPTION 'Receita não encontrada para este sabor';
  END IF;

  -- Loop through ALL ingredients for this sabor and deduct each
  FOR v_receita IN SELECT * FROM sabor_receita WHERE sabor_id = p_sabor_id LOOP
    v_has_receita := true;
    
    DECLARE
      v_insumo_necessario numeric;
      v_estoque_mp numeric;
    BEGIN
      IF p_modo = 'lote' THEN
        v_insumo_necessario := v_receita.quantidade_insumo_por_lote * p_quantidade_lotes;
      ELSE
        v_insumo_necessario := (v_receita.quantidade_insumo_por_lote::numeric / v_gelos_por_lote) * p_quantidade_total;
      END IF;

      IF NOT p_ignorar_estoque THEN
        SELECT estoque_atual INTO v_estoque_mp FROM materias_primas WHERE id = v_receita.materia_prima_id;
        IF v_estoque_mp < v_insumo_necessario THEN
          RAISE EXCEPTION 'Estoque insuficiente de matéria-prima (%). Necessário: %, Disponível: %',
            (SELECT nome FROM materias_primas WHERE id = v_receita.materia_prima_id),
            v_insumo_necessario, v_estoque_mp;
        END IF;
      END IF;

      UPDATE materias_primas SET estoque_atual = estoque_atual - v_insumo_necessario WHERE id = v_receita.materia_prima_id;
    END;
  END LOOP;

  IF NOT v_has_receita THEN
    RAISE EXCEPTION 'Receita não encontrada para este sabor';
  END IF;

  -- Validate and deduct packaging (only once, from the first recipe's embalagem)
  DECLARE
    v_emb_necessaria integer;
    v_estoque_emb integer;
  BEGIN
    IF p_modo = 'lote' THEN
      v_emb_necessaria := v_embalagens_por_lote * p_quantidade_lotes;
    ELSE
      v_emb_necessaria := p_quantidade_total;
    END IF;

    IF NOT p_ignorar_estoque THEN
      SELECT estoque_atual INTO v_estoque_emb FROM embalagens WHERE id = v_embalagem_id;
      IF v_estoque_emb < v_emb_necessaria THEN
        RAISE EXCEPTION 'Estoque insuficiente de embalagens. Necessário: %, Disponível: %', v_emb_necessaria, v_estoque_emb;
      END IF;
    END IF;

    UPDATE embalagens SET estoque_atual = estoque_atual - v_emb_necessaria WHERE id = v_embalagem_id;
  END;

  -- Insert production record
  INSERT INTO producoes (sabor_id, modo, quantidade_lotes, quantidade_total, operador, observacoes, factory_id)
  VALUES (p_sabor_id, p_modo, p_quantidade_lotes, p_quantidade_total, p_operador, p_observacoes, v_factory_id)
  RETURNING id INTO v_producao_id;

  -- Insert responsible workers
  FOR v_func IN SELECT * FROM jsonb_array_elements(p_funcionarios) LOOP
    INSERT INTO producao_funcionarios (producao_id, funcionario_id, quantidade_produzida, factory_id)
    VALUES (
      v_producao_id,
      (v_func->>'funcionario_id')::uuid,
      COALESCE((v_func->>'quantidade_produzida')::integer, 0),
      v_factory_id
    );
  END LOOP;

  -- Update ice stock
  INSERT INTO estoque_gelos (sabor_id, quantidade, factory_id)
  VALUES (p_sabor_id, p_quantidade_total, v_factory_id)
  ON CONFLICT (sabor_id) DO UPDATE SET quantidade = estoque_gelos.quantidade + p_quantidade_total;

  -- Record stock movement
  INSERT INTO movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, operador, referencia, referencia_id, factory_id)
  VALUES ('gelo_pronto', p_sabor_id, 'entrada', p_quantidade_total, p_operador, 'producao', v_producao_id, v_factory_id);

  -- Audit
  INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
  VALUES ('producao', 'criar', p_operador, v_producao_id, 'Produção de ' || p_quantidade_total || ' unidades', v_factory_id);

  RETURN v_producao_id;
END;
$function$;