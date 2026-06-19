
-- ============================================================
-- AUDITORIA VENDAS x ESTOQUE
-- Funções transacionais: ajustar_venda_item + cancelar_venda
-- ============================================================

CREATE OR REPLACE FUNCTION public.ajustar_venda_item(
  p_venda_id uuid,
  p_sabor_id uuid,
  p_quantidade_nova integer,
  p_preco_unitario numeric DEFAULT NULL,
  p_regra text DEFAULT 'manual',
  p_operador text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factory_id uuid;
  v_item RECORD;
  v_qtd_atual integer := 0;
  v_delta integer;
  v_estoque_antes integer := 0;
  v_estoque_depois integer := 0;
  v_preco numeric(10,2);
  v_sabor_nome text;
BEGIN
  SELECT factory_id INTO v_factory_id FROM vendas WHERE id = p_venda_id;
  IF v_factory_id IS NULL THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  SELECT nome INTO v_sabor_nome FROM sabores WHERE id = p_sabor_id;

  -- Item atual (ignora brindes/preço 0 da soma de qty)
  SELECT id, quantidade, preco_unitario
    INTO v_item
  FROM venda_itens
  WHERE venda_id = p_venda_id AND sabor_id = p_sabor_id
  ORDER BY (preco_unitario > 0) DESC
  LIMIT 1;

  v_qtd_atual := COALESCE(v_item.quantidade, 0);
  v_delta := p_quantidade_nova - v_qtd_atual;
  v_preco := COALESCE(p_preco_unitario, v_item.preco_unitario, 0);

  SELECT COALESCE(quantidade, 0) INTO v_estoque_antes
  FROM estoque_gelos WHERE sabor_id = p_sabor_id;

  IF v_delta > 0 THEN
    -- Debita estoque
    IF v_estoque_antes < v_delta THEN
      RAISE EXCEPTION 'Estoque insuficiente para %. Disponível: %, necessário adicional: %',
        v_sabor_nome, v_estoque_antes, v_delta;
    END IF;
    UPDATE estoque_gelos SET quantidade = quantidade - v_delta, updated_at = now()
    WHERE sabor_id = p_sabor_id;
    INSERT INTO movimentacoes_estoque
      (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES ('gelo_pronto', p_sabor_id, 'saida', v_delta, 'venda', p_venda_id, p_operador, v_factory_id);
  ELSIF v_delta < 0 THEN
    -- Estorna estoque
    INSERT INTO estoque_gelos (sabor_id, quantidade, factory_id)
    VALUES (p_sabor_id, ABS(v_delta), v_factory_id)
    ON CONFLICT (sabor_id) DO UPDATE SET quantidade = estoque_gelos.quantidade + ABS(v_delta), updated_at = now();
    INSERT INTO movimentacoes_estoque
      (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES ('gelo_pronto', p_sabor_id, 'entrada', ABS(v_delta), 'edicao_venda', p_venda_id, p_operador, v_factory_id);
  END IF;

  SELECT COALESCE(quantidade, 0) INTO v_estoque_depois
  FROM estoque_gelos WHERE sabor_id = p_sabor_id;

  -- venda_itens: insert, update ou delete
  IF p_quantidade_nova = 0 THEN
    IF v_item.id IS NOT NULL THEN
      DELETE FROM venda_itens WHERE id = v_item.id;
    END IF;
  ELSIF v_item.id IS NULL THEN
    INSERT INTO venda_itens
      (venda_id, sabor_id, quantidade, preco_unitario, subtotal, regra_preco_aplicada, factory_id)
    VALUES (p_venda_id, p_sabor_id, p_quantidade_nova, v_preco, v_preco * p_quantidade_nova, p_regra, v_factory_id);
  ELSE
    UPDATE venda_itens
       SET quantidade = p_quantidade_nova,
           preco_unitario = v_preco,
           subtotal = v_preco * p_quantidade_nova
     WHERE id = v_item.id;
  END IF;

  -- Auditoria detalhada
  IF v_delta <> 0 THEN
    INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES (
      'estoque',
      CASE WHEN v_delta > 0 THEN 'edicao_venda_saida' ELSE 'edicao_venda_estorno' END,
      p_operador,
      p_venda_id,
      format('Sabor %s | qtd antes=%s -> depois=%s (delta %s) | estoque antes=%s -> depois=%s',
             v_sabor_nome, v_qtd_atual, p_quantidade_nova, v_delta, v_estoque_antes, v_estoque_depois),
      v_factory_id
    );
  END IF;

  RETURN jsonb_build_object(
    'sabor_id', p_sabor_id,
    'qtd_antes', v_qtd_atual,
    'qtd_depois', p_quantidade_nova,
    'delta', v_delta,
    'estoque_antes', v_estoque_antes,
    'estoque_depois', v_estoque_depois
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ajustar_venda_item(uuid, uuid, integer, numeric, text, text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.cancelar_venda(
  p_venda_id uuid,
  p_operador text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda RECORD;
  v_item RECORD;
  v_estornados integer := 0;
BEGIN
  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id;
  IF v_venda IS NULL THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;
  IF v_venda.status = 'cancelada' THEN
    RETURN jsonb_build_object('status','ja_cancelada');
  END IF;

  FOR v_item IN
    SELECT sabor_id, SUM(quantidade)::int AS qtd
    FROM venda_itens
    WHERE venda_id = p_venda_id AND preco_unitario > 0
    GROUP BY sabor_id
  LOOP
    INSERT INTO estoque_gelos (sabor_id, quantidade, factory_id)
    VALUES (v_item.sabor_id, v_item.qtd, v_venda.factory_id)
    ON CONFLICT (sabor_id) DO UPDATE SET quantidade = estoque_gelos.quantidade + v_item.qtd, updated_at = now();

    INSERT INTO movimentacoes_estoque
      (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES ('gelo_pronto', v_item.sabor_id, 'entrada', v_item.qtd, 'cancelamento_venda', p_venda_id, p_operador, v_venda.factory_id);

    v_estornados := v_estornados + v_item.qtd;
  END LOOP;

  UPDATE vendas SET status = 'cancelada' WHERE id = p_venda_id;

  INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
  VALUES ('vendas','cancelar', p_operador, p_venda_id,
    format('Venda cancelada - %s unidades estornadas ao estoque', v_estornados),
    v_venda.factory_id);

  RETURN jsonb_build_object('status','cancelada','estornados', v_estornados);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_venda(uuid, text) TO authenticated, service_role;
