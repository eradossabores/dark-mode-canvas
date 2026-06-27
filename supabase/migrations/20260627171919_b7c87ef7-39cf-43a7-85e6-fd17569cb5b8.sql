
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS status_recebimento text NOT NULL DEFAULT 'recebido'
    CHECK (status_recebimento IN ('pendente','recebido_parcial','recebido')),
  ADD COLUMN IF NOT EXISTS quantidade_recebida numeric,
  ADD COLUMN IF NOT EXISTS data_prevista_chegada date,
  ADD COLUMN IF NOT EXISTS data_recebimento timestamptz,
  ADD COLUMN IF NOT EXISTS recebido_por text;

CREATE INDEX IF NOT EXISTS idx_compras_status_recebimento
  ON public.compras(factory_id, status_recebimento)
  WHERE status_recebimento <> 'recebido';

CREATE OR REPLACE FUNCTION public.confirmar_recebimento_compra(
  p_compra_id uuid,
  p_quantidade_recebida numeric,
  p_operador text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
  v_tabela text;
  v_item_id uuid;
  v_estoque_atual numeric;
  v_novo_status text;
  v_qtd_a_creditar numeric;
BEGIN
  SELECT * INTO v_compra FROM compras WHERE id = p_compra_id;
  IF v_compra IS NULL THEN
    RAISE EXCEPTION 'Compra não encontrada';
  END IF;

  IF v_compra.status_recebimento = 'recebido' THEN
    RAISE EXCEPTION 'Compra já foi totalmente recebida';
  END IF;

  IF p_quantidade_recebida IS NULL OR p_quantidade_recebida < 0 THEN
    RAISE EXCEPTION 'Quantidade recebida inválida';
  END IF;

  IF p_quantidade_recebida > v_compra.quantidade THEN
    RAISE EXCEPTION 'Quantidade recebida (%) maior que a pedida (%)',
      p_quantidade_recebida, v_compra.quantidade;
  END IF;

  v_qtd_a_creditar := p_quantidade_recebida - COALESCE(v_compra.quantidade_recebida, 0);

  IF v_qtd_a_creditar < 0 THEN
    RAISE EXCEPTION 'Não é possível diminuir o recebido já confirmado';
  END IF;

  v_tabela := CASE WHEN v_compra.tipo = 'insumo' THEN 'materias_primas' ELSE 'embalagens' END;

  -- Localiza item por nome (com fallback ILIKE)
  IF v_tabela = 'materias_primas' THEN
    SELECT id, estoque_atual INTO v_item_id, v_estoque_atual
    FROM materias_primas
    WHERE factory_id = v_compra.factory_id AND nome = v_compra.item_nome
    LIMIT 1;
    IF v_item_id IS NULL THEN
      SELECT id, estoque_atual INTO v_item_id, v_estoque_atual
      FROM materias_primas
      WHERE factory_id = v_compra.factory_id AND nome ILIKE '%' || v_compra.item_nome || '%'
      LIMIT 1;
    END IF;
  ELSE
    SELECT id, estoque_atual INTO v_item_id, v_estoque_atual
    FROM embalagens
    WHERE factory_id = v_compra.factory_id AND nome = v_compra.item_nome
    LIMIT 1;
    IF v_item_id IS NULL THEN
      SELECT id, estoque_atual INTO v_item_id, v_estoque_atual
      FROM embalagens
      WHERE factory_id = v_compra.factory_id AND nome ILIKE '%' || v_compra.item_nome || '%'
      LIMIT 1;
    END IF;
  END IF;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Item % não encontrado em %', v_compra.item_nome, v_tabela;
  END IF;

  -- Credita estoque
  IF v_qtd_a_creditar > 0 THEN
    IF v_tabela = 'materias_primas' THEN
      UPDATE materias_primas
        SET estoque_atual = COALESCE(estoque_atual,0) + v_qtd_a_creditar,
            updated_at = now()
      WHERE id = v_item_id;
    ELSE
      UPDATE embalagens
        SET estoque_atual = COALESCE(estoque_atual,0) + v_qtd_a_creditar,
            updated_at = now()
      WHERE id = v_item_id;
    END IF;

    INSERT INTO movimentacoes_estoque
      (tipo_item, item_id, tipo_movimentacao, quantidade, referencia, referencia_id, operador, factory_id)
    VALUES (v_compra.tipo, v_item_id, 'entrada', v_qtd_a_creditar,
            'recebimento_compra', p_compra_id, p_operador, v_compra.factory_id);
  END IF;

  v_novo_status := CASE
    WHEN p_quantidade_recebida >= v_compra.quantidade THEN 'recebido'
    WHEN p_quantidade_recebida > 0 THEN 'recebido_parcial'
    ELSE 'pendente'
  END;

  UPDATE compras
    SET quantidade_recebida = p_quantidade_recebida,
        status_recebimento = v_novo_status,
        data_recebimento = CASE WHEN v_novo_status <> 'pendente' THEN now() ELSE data_recebimento END,
        recebido_por = CASE WHEN v_novo_status <> 'pendente' THEN p_operador ELSE recebido_por END
  WHERE id = p_compra_id;

  INSERT INTO auditoria(modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
  VALUES ('compras','confirmar_recebimento', p_operador, p_compra_id,
    format('Recebimento %s de %s: %s de %s %s (creditado: %s)',
      v_novo_status, v_compra.item_nome, p_quantidade_recebida, v_compra.quantidade,
      COALESCE(v_compra.unidade,''), v_qtd_a_creditar),
    v_compra.factory_id);

  RETURN jsonb_build_object(
    'status', v_novo_status,
    'creditado', v_qtd_a_creditar,
    'item_id', v_item_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_recebimento_compra(uuid, numeric, text) TO authenticated;
