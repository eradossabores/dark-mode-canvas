
-- Add numero_pedido column to vendas
ALTER TABLE public.vendas ADD COLUMN numero_pedido integer;

-- Create a sequence-like function that auto-assigns order numbers per factory
CREATE OR REPLACE FUNCTION public.set_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT COALESCE(MAX(numero_pedido), 0) + 1 INTO v_next
  FROM public.vendas
  WHERE factory_id = NEW.factory_id;
  
  NEW.numero_pedido := v_next;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-set numero_pedido on insert
CREATE TRIGGER trg_set_numero_pedido
  BEFORE INSERT ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_numero_pedido();

-- Backfill existing vendas with sequential numbers per factory
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY factory_id ORDER BY created_at ASC) AS rn
  FROM public.vendas
)
UPDATE public.vendas v
SET numero_pedido = n.rn
FROM numbered n
WHERE v.id = n.id;
