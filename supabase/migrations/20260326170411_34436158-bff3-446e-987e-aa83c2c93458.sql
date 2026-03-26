
CREATE OR REPLACE FUNCTION public.realizar_venda(p_cliente_id uuid, p_operador text, p_observacoes text, p_itens jsonb, p_parcelas jsonb DEFAULT NULL::jsonb, p_ignorar_estoque boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_total_qtd INTEGER := 0;
  v_factory_id UUID;
BEGIN
  SELECT nome, factory_id INTO v_cliente_nome, v_factory_id FROM public.clientes WHERE id = p_cliente_id AND status = 'ativo';
  IF v_cliente_nome IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado ou inativo'; END IF;

  SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0) INTO v_total_qtd
  FROM jsonb_array_elements(p_itens) AS item;

  INSERT INTO public.vendas (cliente_id, total, operador, observacoes, factory_id)
  VALUES (p_cliente_id, 0, p_operador, p_observacoes, v_factory_id) RETURNING id INTO v_venda_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_sabor_id := (v_item->>'sabor_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INTEGER;

    IF NOT p_ignorar_estoque THEN
      SELECT quantidade INTO v_estoque FROM public.estoque_gelos WHERE sabor_id = v_sabor_id FOR UPDATE;
      IF v_estoque IS NULL OR v_estoque < v_quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para sabor %. Disponível: %, Solicitado: %',
          (SELECT nome FROM public.sabores WHERE id = v_sabor_id), COALESCE(v_estoque, 0), v_quantidade;
      END IF;
    END IF;

    v_preco := public.calcular_preco(p_cliente_id, v_sabor_id, v_total_qtd);
    v_subtotal := v_preco * v_quantidade;
    v_total := v_total + v_subtotal;

    IF EXISTS (SELECT 1 FROM public.cliente_preco_sabor WHERE cliente_id = p_cliente_id AND sabor_id = v_sabor_id) THEN
      v_regra := 'preco_sabor_personalizado';
    ELSIF EXISTS (SELECT 1 FROM public.cliente_tabela_preco WHERE cliente_id = p_cliente_id AND quantidade_minima <= v_total_qtd) THEN
      v_regra := 'tabela_progressiva_personalizada';
    ELSIF (SELECT preco_padrao_personalizado FROM public.clientes WHERE id = p_cliente_id) IS NOT NULL THEN
      v_regra := 'preco_padrao_personalizado';
    ELSIF v_total_qtd >= 10 THEN
      v_regra := 'tabela_progressiva_padrao';
    ELSE
      v_regra := 'preco_base';
    END IF;

    INSERT INTO public.venda_itens (venda_id, sabor_id, quantidade, preco_unitario, subtotal, regra_preco_aplicada, factory_id)
    VALUES (v_venda_id, v_sabor_id, v_quantidade, v_preco, v_subtotal, v_regra, v_factory_id);

    UPDATE public.estoque_gelos SET quantidade = quantidade - v_quantidade WHERE sabor_id = v_sabor_id;

    INSERT INTO public.movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES ('gelo_pronto', v_sabor_id, 'saida', v_quantidade, 'venda', v_venda_id, p_operador, v_factory_id);
  END LOOP;

  UPDATE public.vendas SET total = v_total WHERE id = v_venda_id;
  UPDATE public.clientes SET ultima_compra = now() WHERE id = p_cliente_id;

  IF p_parcelas IS NOT NULL THEN
    FOR v_parcela IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
      v_num_parcela := v_num_parcela + 1;
      INSERT INTO public.venda_parcelas (venda_id, numero, valor, vencimento, factory_id)
      VALUES (v_venda_id, v_num_parcela, (v_parcela->>'valor')::NUMERIC, (v_parcela->>'vencimento')::DATE, v_factory_id);
    END LOOP;
  END IF;

  INSERT INTO public.auditoria (usuario_nome, modulo, acao, registro_afetado, descricao, factory_id)
  VALUES (p_operador, 'vendas', 'criar', v_venda_id,
    format('Venda de R$ %s para cliente %s', v_total, v_cliente_nome), v_factory_id);

  RETURN v_venda_id;
END;
$function$;
