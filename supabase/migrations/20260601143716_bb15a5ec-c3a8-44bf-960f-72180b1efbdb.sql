
-- ============ VENDAS: campos de entrega ============
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS status_entrega text NOT NULL DEFAULT 'aguardando_entrega',
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS entregue_por text,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_por text;

CREATE INDEX IF NOT EXISTS idx_vendas_status_entrega ON public.vendas(status_entrega);

-- ============ FUNÇÃO: confirmar_entrega_venda ============
CREATE OR REPLACE FUNCTION public.confirmar_entrega_venda(
  p_venda_id uuid,
  p_pago boolean,
  p_operador text,
  p_forma_pagamento text DEFAULT 'especie'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda RECORD;
  v_cliente RECORD;
  v_total_qtd integer := 0;
  v_novo_preco numeric(10,2);
  v_novo_total numeric(12,2);
  v_valor_pix numeric(12,2) := 0;
  v_valor_especie numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id;
  IF v_venda IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = v_venda.cliente_id;

  IF p_pago THEN
    -- Pagamento recebido na entrega: cria abatimento total
    IF p_forma_pagamento = 'pix' THEN
      v_valor_pix := v_venda.total;
    ELSIF p_forma_pagamento = 'especie' THEN
      v_valor_especie := v_venda.total;
    END IF;

    INSERT INTO abatimentos_historico(venda_id, valor, forma_pagamento, valor_pix, valor_especie, factory_id)
    VALUES (p_venda_id, v_venda.total, p_forma_pagamento, v_valor_pix, v_valor_especie, v_venda.factory_id);

    UPDATE vendas
    SET status_entrega = 'entregue_pago',
        entregue_em = now(),
        entregue_por = p_operador,
        pagamento_confirmado_em = now(),
        pagamento_confirmado_por = p_operador
    WHERE id = p_venda_id;

    INSERT INTO auditoria(modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES ('vendas','confirmar_entrega', p_operador, p_venda_id,
      format('Entrega confirmada com pagamento %s (R$ %s) - cliente %s', p_forma_pagamento, v_venda.total, v_cliente.nome),
      v_venda.factory_id);

    RETURN jsonb_build_object('status','pago','total', v_venda.total);
  ELSE
    -- Não recebido: converter para A Prazo
    SELECT COALESCE(SUM(quantidade),0) INTO v_total_qtd FROM venda_itens WHERE venda_id = p_venda_id;
    v_novo_preco := COALESCE(v_cliente.preco_unidade_aprazo, 2.05);
    v_novo_total := v_novo_preco * v_total_qtd;

    UPDATE vendas
    SET forma_pagamento_tipo = 'aprazo',
        convertida_automaticamente = true,
        data_conversao = now(),
        valor_original = COALESCE(valor_original, total),
        total = v_novo_total,
        preco_unitario_usado = v_novo_preco,
        status_entrega = 'convertida_prazo',
        entregue_em = now(),
        entregue_por = p_operador,
        data_vencimento = COALESCE(data_vencimento, (CURRENT_DATE + INTERVAL '7 days')::date)
    WHERE id = p_venda_id;

    UPDATE venda_itens
    SET preco_unitario = v_novo_preco,
        subtotal = v_novo_preco * quantidade
    WHERE venda_id = p_venda_id;

    INSERT INTO alertas_financeiros(factory_id, cliente_id, venda_id, tipo, mensagem)
    VALUES (v_venda.factory_id, v_venda.cliente_id, p_venda_id, 'convertida_entrega',
      format('Entrega de %s sem pagamento - convertida para A Prazo (R$ %s)', v_cliente.nome, v_novo_total))
    ON CONFLICT (venda_id, tipo) DO NOTHING;

    INSERT INTO auditoria(modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES ('vendas','converter_entrega_prazo', p_operador, p_venda_id,
      format('Entrega sem pagamento - venda convertida À Vista→A Prazo (R$ %s → R$ %s) cliente %s',
        v_venda.total, v_novo_total, v_cliente.nome),
      v_venda.factory_id);

    PERFORM public.recalcular_saldo_devedor(v_venda.cliente_id);

    RETURN jsonb_build_object('status','convertida','total', v_novo_total, 'preco_unitario', v_novo_preco);
  END IF;
END;
$$;
