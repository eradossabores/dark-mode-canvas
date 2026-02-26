
-- 1. Delete orphan stock movements (entries referencing deleted productions)
DELETE FROM movimentacoes_estoque 
WHERE tipo_item = 'gelo_pronto' 
  AND tipo_movimentacao = 'entrada'
  AND referencia_id IS NOT NULL
  AND referencia_id NOT IN (SELECT id FROM producoes);

-- 2. Recalculate stock for all flavors based on actual movements
UPDATE estoque_gelos eg
SET quantidade = COALESCE((
  SELECT SUM(CASE WHEN me.tipo_movimentacao = 'entrada' THEN me.quantidade ELSE -me.quantidade END)
  FROM movimentacoes_estoque me
  WHERE me.item_id = eg.sabor_id AND me.tipo_item = 'gelo_pronto'
), 0),
updated_at = now();

-- 3. Create trigger to auto-cascade delete movements when a production is deleted
CREATE OR REPLACE FUNCTION public.cascade_delete_producao_movimentacoes()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete stock movements linked to this production
  DELETE FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id 
    AND tipo_item = 'gelo_pronto';
  
  -- Recalculate stock for the affected flavor
  UPDATE estoque_gelos 
  SET quantidade = COALESCE((
    SELECT SUM(CASE WHEN me.tipo_movimentacao = 'entrada' THEN me.quantidade ELSE -me.quantidade END)
    FROM movimentacoes_estoque me
    WHERE me.item_id = estoque_gelos.sabor_id AND me.tipo_item = 'gelo_pronto'
  ), 0),
  updated_at = now()
  WHERE sabor_id = OLD.sabor_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_delete_producao ON producoes;
CREATE TRIGGER trg_cascade_delete_producao
  BEFORE DELETE ON producoes
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_producao_movimentacoes();

-- 4. Same for vendas - cascade delete movements when a sale is deleted
CREATE OR REPLACE FUNCTION public.cascade_delete_venda_movimentacoes()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete stock movements linked to this sale
  DELETE FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id 
    AND tipo_item = 'gelo_pronto';
  
  -- Recalculate stock for all affected flavors from sale items
  UPDATE estoque_gelos 
  SET quantidade = COALESCE((
    SELECT SUM(CASE WHEN me.tipo_movimentacao = 'entrada' THEN me.quantidade ELSE -me.quantidade END)
    FROM movimentacoes_estoque me
    WHERE me.item_id = estoque_gelos.sabor_id AND me.tipo_item = 'gelo_pronto'
  ), 0),
  updated_at = now()
  WHERE sabor_id IN (SELECT sabor_id FROM venda_itens WHERE venda_id = OLD.id);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_delete_venda ON vendas;
CREATE TRIGGER trg_cascade_delete_venda
  BEFORE DELETE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_venda_movimentacoes();
