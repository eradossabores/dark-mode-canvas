
-- Restore correct stock values (baseline + clean movements)
-- Formula: correct = old_displayed - orphan_inflation
-- These are the verified correct values

UPDATE estoque_gelos SET quantidade = 542, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Melancia');

UPDATE estoque_gelos SET quantidade = 578, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Maçã Verde');

UPDATE estoque_gelos SET quantidade = 461, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Morango');

UPDATE estoque_gelos SET quantidade = 406, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Maracujá');

UPDATE estoque_gelos SET quantidade = 159, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Água de Coco');

UPDATE estoque_gelos SET quantidade = 157, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Bob Marley');

UPDATE estoque_gelos SET quantidade = 42, updated_at = now()
WHERE sabor_id = (SELECT id FROM sabores WHERE nome = 'Abacaxi com Hortelã');

-- Also fix the cascade trigger to NOT recalculate from movements alone
-- Instead, just adjust the stock by the deleted production/sale amount
CREATE OR REPLACE FUNCTION public.cascade_delete_producao_movimentacoes()
RETURNS TRIGGER AS $$
DECLARE
  v_quantidade NUMERIC;
BEGIN
  -- Get total quantity from movements linked to this production
  SELECT COALESCE(SUM(
    CASE WHEN tipo_movimentacao = 'entrada' THEN quantidade ELSE -quantidade END
  ), 0) INTO v_quantidade
  FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto';

  -- Delete stock movements linked to this production
  DELETE FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto';
  
  -- Subtract the net effect from current stock
  UPDATE estoque_gelos 
  SET quantidade = quantidade - v_quantidade,
      updated_at = now()
  WHERE sabor_id = OLD.sabor_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cascade_delete_venda_movimentacoes()
RETURNS TRIGGER AS $$
BEGIN
  -- For each movement linked to this sale, reverse the stock effect
  UPDATE estoque_gelos eg
  SET quantidade = eg.quantidade - COALESCE((
    SELECT SUM(CASE WHEN me.tipo_movimentacao = 'entrada' THEN me.quantidade ELSE -me.quantidade END)
    FROM movimentacoes_estoque me
    WHERE me.referencia_id = OLD.id AND me.tipo_item = 'gelo_pronto' AND me.item_id = eg.sabor_id
  ), 0),
  updated_at = now()
  WHERE eg.sabor_id IN (
    SELECT DISTINCT item_id FROM movimentacoes_estoque 
    WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto'
  );

  -- Delete stock movements linked to this sale
  DELETE FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
