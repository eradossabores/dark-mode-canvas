ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS sem_baixa_estoque boolean NOT NULL DEFAULT false;

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
  v_sabor_nome TEXT;
  v_sabor_factory_id UUID;
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
  v_rows_updated INTEGER := 0;
BEGIN
  SELECT nome, factory_id
    INTO v_cliente_nome, v_factory_id
  FROM public.clientes
  WHERE id = p_cliente_id
    AND status = 'ativo';

  IF v_cliente_nome IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou inativo';
  END IF;

  IF v_factory_id IS NULL THEN
    RAISE EXCEPTION 'Cliente % não possui fábrica vinculada', v_cliente_nome;
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Venda sem itens não pode ser registrada';
  END IF;

  SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
    INTO v_total_qtd
  FROM jsonb_array_elements(p_itens) AS item;

  IF v_total_qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade total da venda deve ser maior que zero';
  END IF;

  INSERT INTO public.vendas (cliente_id, total, operador, observacoes, factory_id, sem_baixa_estoque)
  VALUES (p_cliente_id, 0, p_operador, p_observacoes, v_factory_id, COALESCE(p_ignorar_estoque, false))
  RETURNING id INTO v_venda_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_sabor_id := (v_item->>'sabor_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INTEGER;

    IF v_sabor_id IS NULL OR v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Item de venda inválido: sabor e quantidade são obrigatórios';
    END IF;

    SELECT nome, factory_id
      INTO v_sabor_nome, v_sabor_factory_id
    FROM public.sabores
    WHERE id = v_sabor_id
      AND ativo = true;

    IF v_sabor_nome IS NULL THEN
      RAISE EXCEPTION 'Sabor % não encontrado ou inativo', v_sabor_id;
    END IF;

    IF v_sabor_factory_id IS DISTINCT FROM v_factory_id THEN
      RAISE EXCEPTION 'Sabor % não pertence à fábrica do cliente %', v_sabor_nome, v_cliente_nome;
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
    ELSIF EXISTS (SELECT 1 FROM public.factory_preco_sabor WHERE factory_id = v_factory_id AND sabor_id = v_sabor_id) THEN
      v_regra := 'preco_sabor_fabrica';
    ELSIF EXISTS (SELECT 1 FROM public.factory_pricing_tiers WHERE factory_id = v_factory_id AND quantidade_minima <= v_total_qtd) THEN
      v_regra := 'tabela_progressiva_fabrica';
    ELSE
      v_regra := 'preco_base';
    END IF;

    INSERT INTO public.venda_itens (venda_id, sabor_id, quantidade, preco_unitario, subtotal, regra_preco_aplicada, factory_id)
    VALUES (v_venda_id, v_sabor_id, v_quantidade, v_preco, v_subtotal, v_regra, v_factory_id);

    -- Quando "ignorar estoque" está marcado: NÃO movimenta estoque de forma alguma
    IF COALESCE(p_ignorar_estoque, false) THEN
      CONTINUE;
    END IF;

    SELECT quantidade
      INTO v_estoque
    FROM public.estoque_gelos
    WHERE sabor_id = v_sabor_id
      AND factory_id = v_factory_id
    FOR UPDATE;

    IF v_estoque IS NULL THEN
      RAISE EXCEPTION 'Estoque não cadastrado para sabor % nesta fábrica', v_sabor_nome;
    END IF;

    IF v_estoque < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para sabor %. Disponível: %, Solicitado: %',
        v_sabor_nome, v_estoque, v_quantidade;
    END IF;

    UPDATE public.estoque_gelos
    SET quantidade = quantidade - v_quantidade,
        updated_at = now()
    WHERE sabor_id = v_sabor_id
      AND factory_id = v_factory_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated <> 1 THEN
      RAISE EXCEPTION 'Falha ao baixar estoque do sabor % na fábrica correta. Venda cancelada.', v_sabor_nome;
    END IF;

    INSERT INTO public.movimentacoes_estoque (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES ('gelo_pronto', v_sabor_id, 'saida', v_quantidade, 'venda', v_venda_id, p_operador, v_factory_id);
  END LOOP;

  UPDATE public.vendas
  SET total = v_total
  WHERE id = v_venda_id;

  UPDATE public.clientes
  SET ultima_compra = now()
  WHERE id = p_cliente_id;

  IF p_parcelas IS NOT NULL THEN
    FOR v_parcela IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
      v_num_parcela := v_num_parcela + 1;
      INSERT INTO public.venda_parcelas (venda_id, numero, valor, vencimento, factory_id)
      VALUES (v_venda_id, v_num_parcela, (v_parcela->>'valor')::NUMERIC, (v_parcela->>'vencimento')::DATE, v_factory_id);
    END LOOP;
  END IF;

  INSERT INTO public.auditoria (usuario_nome, modulo, acao, registro_afetado, descricao, factory_id)
  VALUES (p_operador, 'vendas', 'criar', v_venda_id,
    format('Venda de R$ %s para cliente %s%s', v_total, v_cliente_nome,
           CASE WHEN COALESCE(p_ignorar_estoque,false) THEN ' (sem baixa de estoque)' ELSE '' END), v_factory_id);

  RETURN v_venda_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id uuid, p_operador text DEFAULT 'sistema'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT COALESCE(v_venda.sem_baixa_estoque, false) THEN
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
  END IF;

  UPDATE vendas SET status = 'cancelada' WHERE id = p_venda_id;

  INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
  VALUES ('vendas','cancelar', p_operador, p_venda_id,
    format('Venda cancelada - %s unidades estornadas ao estoque', v_estornados),
    v_venda.factory_id);

  RETURN jsonb_build_object('status','cancelada','estornados', v_estornados);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_venda_item(p_venda_id uuid, p_sabor_id uuid, p_quantidade_nova integer, p_preco_unitario numeric DEFAULT NULL::numeric, p_regra text DEFAULT 'manual'::text, p_operador text DEFAULT 'sistema'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factory_id uuid;
  v_sem_baixa boolean := false;
  v_item RECORD;
  v_qtd_atual integer := 0;
  v_delta integer;
  v_estoque_antes integer := 0;
  v_estoque_depois integer := 0;
  v_preco numeric(10,2);
  v_sabor_nome text;
BEGIN
  SELECT factory_id, COALESCE(sem_baixa_estoque,false) INTO v_factory_id, v_sem_baixa FROM vendas WHERE id = p_venda_id;
  IF v_factory_id IS NULL THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  SELECT nome INTO v_sabor_nome FROM sabores WHERE id = p_sabor_id;

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

  IF v_sem_baixa THEN
    v_estoque_depois := v_estoque_antes;
  ELSIF v_delta > 0 THEN
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
    INSERT INTO estoque_gelos (sabor_id, quantidade, factory_id)
    VALUES (p_sabor_id, ABS(v_delta), v_factory_id)
    ON CONFLICT (sabor_id) DO UPDATE SET quantidade = estoque_gelos.quantidade + ABS(v_delta), updated_at = now();
    INSERT INTO movimentacoes_estoque
      (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES ('gelo_pronto', p_sabor_id, 'entrada', ABS(v_delta), 'edicao_venda', p_venda_id, p_operador, v_factory_id);
  END IF;

  IF NOT v_sem_baixa THEN
    SELECT COALESCE(quantidade, 0) INTO v_estoque_depois
    FROM estoque_gelos WHERE sabor_id = p_sabor_id;
  END IF;

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

  IF v_delta <> 0 THEN
    INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES (
      'estoque',
      CASE WHEN v_delta > 0 THEN 'edicao_venda_saida' ELSE 'edicao_venda_estorno' END,
      p_operador,
      p_venda_id,
      format('Sabor %s | qtd antes=%s -> depois=%s (delta %s) | estoque antes=%s -> depois=%s%s',
             v_sabor_nome, v_qtd_atual, p_quantidade_nova, v_delta, v_estoque_antes, v_estoque_depois,
             CASE WHEN v_sem_baixa THEN ' | venda sem baixa de estoque' ELSE '' END),
      v_factory_id
    );
  END IF;

  RETURN jsonb_build_object(
    'sabor_id', p_sabor_id,
    'qtd_antes', v_qtd_atual,
    'qtd_depois', p_quantidade_nova,
    'delta', v_delta,
    'estoque_antes', v_estoque_antes,
    'estoque_depois', v_estoque_depois,
    'sem_baixa_estoque', v_sem_baixa
  );
END;
$function$;