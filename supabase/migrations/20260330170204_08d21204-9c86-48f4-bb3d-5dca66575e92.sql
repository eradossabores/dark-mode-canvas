
-- Fix invites SELECT: only allow lookup by specific token or by admins
DROP POLICY IF EXISTS "Lookup invite by token" ON public.invites;

-- Admins can view all invites (already exists, keep)
-- Public/anon users should NOT be able to list all invites
-- The process-invite edge function uses service role, so it bypasses RLS

-- Fix the two "always true" warnings on pedidos_publicos INSERT
-- pedidos_publicos INSERT with true is intentional for public ordering - keep as is

-- Fix function search_path for cascade functions
CREATE OR REPLACE FUNCTION public.cascade_delete_producao_movimentacoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quantidade NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN tipo_movimentacao = 'entrada' THEN quantidade ELSE -quantidade END
  ), 0) INTO v_quantidade
  FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto';

  DELETE FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto';
  
  UPDATE estoque_gelos 
  SET quantidade = quantidade - v_quantidade,
      updated_at = now()
  WHERE sabor_id = OLD.sabor_id;
  
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cascade_delete_venda_movimentacoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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

  DELETE FROM movimentacoes_estoque 
  WHERE referencia_id = OLD.id AND tipo_item = 'gelo_pronto';
  
  RETURN OLD;
END;
$function$;
