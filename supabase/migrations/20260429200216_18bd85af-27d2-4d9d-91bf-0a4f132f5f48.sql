-- 1) Prevent duplicate stock movements (same item, qty, operator, type, ref within same second)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_movimentacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.movimentacoes_estoque
    WHERE tipo_item = NEW.tipo_item
      AND item_id = NEW.item_id
      AND tipo_movimentacao = NEW.tipo_movimentacao
      AND quantidade = NEW.quantidade
      AND COALESCE(operador,'') = COALESCE(NEW.operador,'')
      AND COALESCE(referencia,'') = COALESCE(NEW.referencia,'')
      AND COALESCE(referencia_id::text,'') = COALESCE(NEW.referencia_id::text,'')
      AND factory_id = NEW.factory_id
      AND date_trunc('second', created_at) = date_trunc('second', COALESCE(NEW.created_at, now()))
      AND id <> COALESCE(NEW.id, gen_random_uuid())
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Movimentação duplicada bloqueada: % de % unidades do item % por % no mesmo segundo.',
      NEW.tipo_movimentacao, NEW.quantidade, NEW.item_id, NEW.operador;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_movimentacao ON public.movimentacoes_estoque;
CREATE TRIGGER trg_prevent_duplicate_movimentacao
BEFORE INSERT ON public.movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_movimentacao();

-- 2) Prevent ghost deductions: outgoing 'venda' movements must match a venda_itens row
CREATE OR REPLACE FUNCTION public.prevent_ghost_venda_movimentacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_qtd INTEGER;
BEGIN
  IF NEW.tipo_item = 'gelo_pronto'
     AND NEW.tipo_movimentacao = 'saida'
     AND NEW.referencia = 'venda'
     AND NEW.referencia_id IS NOT NULL THEN

    SELECT COALESCE(SUM(quantidade), 0) INTO v_item_qtd
    FROM public.venda_itens
    WHERE venda_id = NEW.referencia_id
      AND sabor_id = NEW.item_id;

    IF v_item_qtd = 0 THEN
      RAISE EXCEPTION 'Dedução fantasma bloqueada: venda % não possui item para o sabor %.',
        NEW.referencia_id, NEW.item_id;
    END IF;

    IF NEW.quantidade > v_item_qtd THEN
      RAISE EXCEPTION 'Dedução maior que o item da venda: tentando deduzir % mas o item da venda % tem apenas %.',
        NEW.quantidade, NEW.referencia_id, v_item_qtd;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ghost_venda_movimentacao ON public.movimentacoes_estoque;
CREATE TRIGGER trg_prevent_ghost_venda_movimentacao
BEFORE INSERT ON public.movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION public.prevent_ghost_venda_movimentacao();