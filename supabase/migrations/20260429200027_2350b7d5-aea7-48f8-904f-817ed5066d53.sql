
DO $$
DECLARE
  v_factory uuid := '00000000-0000-0000-0000-000000000001';
  v_venda125 uuid := '6e023ab1-94ee-4239-bd78-f65b6b6fcd61';
  v_brasil_id uuid;
  v_dup_id uuid;
  v_dup_qtd numeric;
  v_dup_tipo text;
  v_dup_item uuid;
  r record;
BEGIN
  -- =========================================================
  -- ERRO 1: Pedido #125 — desconto fantasma de "BRASIL" (2 un)
  -- =========================================================
  SELECT item_id INTO v_brasil_id
  FROM movimentacoes_estoque
  WHERE referencia_id = v_venda125
    AND tipo_item = 'gelo_pronto'
    AND tipo_movimentacao = 'saida'
    AND quantidade = 2
    AND item_id = (SELECT id FROM sabores WHERE nome = 'BRASIL' AND factory_id = v_factory)
  LIMIT 1;

  IF v_brasil_id IS NOT NULL THEN
    DELETE FROM movimentacoes_estoque
    WHERE referencia_id = v_venda125
      AND tipo_item = 'gelo_pronto'
      AND tipo_movimentacao = 'saida'
      AND item_id = v_brasil_id
      AND quantidade = 2;

    UPDATE estoque_gelos
    SET quantidade = quantidade + 2, updated_at = now()
    WHERE sabor_id = v_brasil_id;

    INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES ('estoque', 'correcao', 'sistema', v_venda125,
      'Removido desconto fantasma de 2 un de BRASIL do pedido #125 e devolvido ao estoque', v_factory);
  END IF;

  -- =========================================================
  -- ERRO 2: Ajustes manuais duplicados em 05-06/04
  -- Estratégia: para cada grupo de ajustes idênticos no mesmo
  -- segundo, manter o mais antigo e excluir os duplicados,
  -- ajustando o estoque para reverter o efeito acumulado.
  -- =========================================================
  FOR r IN
    WITH grupos AS (
      SELECT
        item_id,
        tipo_movimentacao,
        quantidade,
        date_trunc('second', created_at) AS bucket,
        array_agg(id ORDER BY created_at) AS ids,
        COUNT(*) AS qtd
      FROM movimentacoes_estoque
      WHERE factory_id = v_factory
        AND tipo_item = 'gelo_pronto'
        AND referencia = 'ajuste_manual'
        AND created_at >= '2026-04-01' AND created_at < '2026-05-01'
      GROUP BY item_id, tipo_movimentacao, quantidade, date_trunc('second', created_at)
      HAVING COUNT(*) > 1
    )
    SELECT * FROM grupos
  LOOP
    -- Remove todos exceto o primeiro (mais antigo)
    DELETE FROM movimentacoes_estoque
    WHERE id = ANY(r.ids[2:array_length(r.ids,1)]);

    -- Reverte do estoque o efeito das (qtd-1) duplicações
    IF r.tipo_movimentacao = 'entrada' THEN
      UPDATE estoque_gelos
      SET quantidade = quantidade - (r.quantidade * (r.qtd - 1)), updated_at = now()
      WHERE sabor_id = r.item_id;
    ELSE
      UPDATE estoque_gelos
      SET quantidade = quantidade + (r.quantidade * (r.qtd - 1)), updated_at = now()
      WHERE sabor_id = r.item_id;
    END IF;

    INSERT INTO auditoria (modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES ('estoque', 'correcao', 'sistema', r.item_id,
      format('Removidas %s duplicações de ajuste_manual (%s %s un) em %s', 
        r.qtd - 1, r.tipo_movimentacao, r.quantidade, r.bucket), v_factory);
  END LOOP;
END $$;
