
-- 1) Função que mantém valor_original coerente com os itens
CREATE OR REPLACE FUNCTION public.sync_valor_original_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_id uuid;
  v_bruto numeric(10,2);
BEGIN
  v_venda_id := COALESCE(NEW.venda_id, OLD.venda_id);
  IF v_venda_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_bruto
  FROM public.venda_itens WHERE venda_id = v_venda_id;

  UPDATE public.vendas v
     SET valor_original = GREATEST(COALESCE(v.total, 0), v_bruto + COALESCE(v.valor_frete, 0)),
         updated_at = now()
   WHERE v.id = v_venda_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_valor_original_venda ON public.venda_itens;
CREATE TRIGGER trg_sync_valor_original_venda
AFTER INSERT OR UPDATE OR DELETE ON public.venda_itens
FOR EACH ROW EXECUTE FUNCTION public.sync_valor_original_venda();

-- 2) Backfill: remove descontos falsos
WITH somas AS (
  SELECT venda_id, COALESCE(SUM(subtotal), 0) AS bruto
  FROM public.venda_itens GROUP BY venda_id
)
UPDATE public.vendas v
   SET valor_original = GREATEST(COALESCE(v.total, 0), s.bruto + COALESCE(v.valor_frete, 0))
  FROM somas s
 WHERE s.venda_id = v.id
   AND COALESCE(v.valor_original, 0) <> GREATEST(COALESCE(v.total, 0), s.bruto + COALESCE(v.valor_frete, 0));
