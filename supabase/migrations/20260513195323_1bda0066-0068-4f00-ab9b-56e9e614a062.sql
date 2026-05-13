CREATE OR REPLACE FUNCTION public.prevent_duplicate_cliente_nome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clientes
    WHERE factory_id = NEW.factory_id
      AND lower(btrim(nome)) = lower(btrim(NEW.nome))
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe um cliente com o nome "%" nesta fábrica.', NEW.nome
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_cliente_nome ON public.clientes;
CREATE TRIGGER trg_prevent_duplicate_cliente_nome
BEFORE INSERT OR UPDATE OF nome ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_cliente_nome();