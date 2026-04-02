
CREATE OR REPLACE FUNCTION public.calcular_preco(p_cliente_id uuid, p_sabor_id uuid, p_quantidade integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_preco_sabor NUMERIC(10,2);
  v_preco_tabela NUMERIC(10,2);
  v_preco_padrao NUMERIC(10,2);
  v_preco_factory NUMERIC(10,2);
  v_factory_id UUID;
BEGIN
  -- 1) Preço específico por sabor do cliente
  SELECT preco_unitario INTO v_preco_sabor
  FROM public.cliente_preco_sabor
  WHERE cliente_id = p_cliente_id AND sabor_id = p_sabor_id;
  IF v_preco_sabor IS NOT NULL THEN RETURN v_preco_sabor; END IF;

  -- 2) Tabela progressiva do cliente
  SELECT preco_unitario INTO v_preco_tabela
  FROM public.cliente_tabela_preco
  WHERE cliente_id = p_cliente_id AND quantidade_minima <= p_quantidade
  ORDER BY quantidade_minima DESC LIMIT 1;
  IF v_preco_tabela IS NOT NULL THEN RETURN v_preco_tabela; END IF;

  -- 3) Preço padrão personalizado do cliente
  SELECT preco_padrao_personalizado, factory_id INTO v_preco_padrao, v_factory_id
  FROM public.clientes WHERE id = p_cliente_id;
  IF v_preco_padrao IS NOT NULL THEN RETURN v_preco_padrao; END IF;

  -- 4) Tabela progressiva da FÁBRICA (factory_pricing_tiers)
  IF v_factory_id IS NOT NULL THEN
    SELECT preco_unitario INTO v_preco_factory
    FROM public.factory_pricing_tiers
    WHERE factory_id = v_factory_id AND quantidade_minima <= p_quantidade
    ORDER BY quantidade_minima DESC LIMIT 1;
    IF v_preco_factory IS NOT NULL THEN RETURN v_preco_factory; END IF;
  END IF;

  -- 5) Fallback genérico
  RETURN 4.99;
END;
$function$;
