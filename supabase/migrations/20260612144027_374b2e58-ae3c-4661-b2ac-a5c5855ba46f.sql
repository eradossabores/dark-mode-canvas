CREATE OR REPLACE FUNCTION public.processar_conversoes_e_alertas_diarios()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda RECORD;
  v_qtd_itens integer;
  v_novo_preco numeric(10,2);
  v_novo_total numeric(12,2);
  v_factory_id uuid;
  v_convertidas integer := 0;
  v_alertas integer := 0;
BEGIN
  FOR v_venda IN
    SELECT v.*, c.preco_unidade_aprazo, c.nome AS cliente_nome, c.factory_id AS cliente_factory_id
    FROM vendas v
    JOIN clientes c ON c.id = v.cliente_id
    WHERE v.forma_pagamento_tipo = 'avista'
      AND v.convertida_automaticamente = false
      AND c.conversao_automatica_prazo = true
      AND v.created_at::date < CURRENT_DATE
      AND COALESCE(v.total,0) > COALESCE((SELECT SUM(ah.valor) FROM abatimentos_historico ah WHERE ah.venda_id = v.id),0)
      AND NOT EXISTS (
        SELECT 1 FROM abatimentos_historico ah
        WHERE ah.venda_id = v.id AND ah.created_at::date = v.created_at::date
      )
  LOOP
    SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_itens FROM venda_itens WHERE venda_id = v_venda.id;
    IF v_qtd_itens = 0 THEN CONTINUE; END IF;
    v_novo_preco := COALESCE(v_venda.preco_unidade_aprazo, 2.05);
    v_novo_total := v_novo_preco * v_qtd_itens;
    v_factory_id := COALESCE(v_venda.factory_id, v_venda.cliente_factory_id);

    UPDATE vendas
    SET forma_pagamento_tipo = 'aprazo',
        convertida_automaticamente = true,
        data_conversao = now(),
        valor_original = COALESCE(valor_original, total),
        total = v_novo_total,
        preco_unitario_usado = v_novo_preco,
        data_vencimento = COALESCE(data_vencimento, (v_venda.created_at::date + INTERVAL '1 day')::date)
    WHERE id = v_venda.id;

    UPDATE venda_itens
    SET preco_unitario = v_novo_preco,
        subtotal = v_novo_preco * quantidade
    WHERE venda_id = v_venda.id;

    IF v_factory_id IS NOT NULL THEN
      INSERT INTO alertas_financeiros(factory_id, cliente_id, venda_id, tipo, mensagem)
      VALUES (v_factory_id, v_venda.cliente_id, v_venda.id, 'convertida',
        format('Venda de %s convertida automaticamente para A Prazo (R$ %s) - não paga no dia da emissão', v_venda.cliente_nome, v_novo_total))
      ON CONFLICT (venda_id, tipo) WHERE venda_id IS NOT NULL DO NOTHING;

      INSERT INTO auditoria(modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
      VALUES ('vendas','conversao_automatica','sistema',v_venda.id,
        format('Venda convertida À Vista→A Prazo automaticamente (R$ %s → R$ %s) cliente %s',
          COALESCE(v_venda.valor_original, v_venda.total), v_novo_total, v_venda.cliente_nome),
        v_factory_id);
    END IF;

    PERFORM public.recalcular_saldo_devedor(v_venda.cliente_id);
    v_convertidas := v_convertidas + 1;
  END LOOP;

  FOR v_venda IN
    SELECT v.id, COALESCE(v.factory_id, c.factory_id) AS factory_id, v.cliente_id, v.data_vencimento, c.nome AS cliente_nome, v.total,
           COALESCE((SELECT SUM(ah.valor) FROM abatimentos_historico ah WHERE ah.venda_id = v.id),0) AS pago
    FROM vendas v JOIN clientes c ON c.id = v.cliente_id
    WHERE v.data_vencimento IS NOT NULL
      AND v.data_vencimento BETWEEN CURRENT_DATE - INTERVAL '2 days' AND CURRENT_DATE
  LOOP
    IF v_venda.total <= v_venda.pago OR v_venda.factory_id IS NULL THEN CONTINUE; END IF;
    DECLARE v_tipo text; v_msg text;
    BEGIN
      IF v_venda.data_vencimento = CURRENT_DATE THEN
        v_tipo := 'vence_hoje';
        v_msg := format('Venda de %s vence hoje (R$ %s)', v_venda.cliente_nome, v_venda.total - v_venda.pago);
      ELSIF v_venda.data_vencimento = CURRENT_DATE - 1 THEN
        v_tipo := 'vencida_1d';
        v_msg := format('Venda de %s vencida há 1 dia (R$ %s)', v_venda.cliente_nome, v_venda.total - v_venda.pago);
      ELSE
        v_tipo := 'vencida_2d';
        v_msg := format('Venda de %s vencida há 2 dias (R$ %s)', v_venda.cliente_nome, v_venda.total - v_venda.pago);
      END IF;
      INSERT INTO alertas_financeiros(factory_id, cliente_id, venda_id, tipo, mensagem)
      VALUES (v_venda.factory_id, v_venda.cliente_id, v_venda.id, v_tipo, v_msg)
      ON CONFLICT (venda_id, tipo) WHERE venda_id IS NOT NULL DO NOTHING;
      v_alertas := v_alertas + 1;
    END;
  END LOOP;

  INSERT INTO alertas_financeiros(factory_id, cliente_id, tipo, mensagem)
  SELECT factory_id, id, 'acima_limite',
    format('Cliente %s está com saldo R$ %s acima do limite de R$ %s', nome, saldo_devedor_atual, limite_credito)
  FROM clientes
  WHERE limite_credito > 0 AND saldo_devedor_atual > limite_credito AND factory_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM alertas_financeiros a
      WHERE a.cliente_id = clientes.id AND a.tipo = 'acima_limite'
        AND a.created_at::date = CURRENT_DATE
    );

  RETURN jsonb_build_object('convertidas', v_convertidas, 'alertas', v_alertas);
END;
$function$;