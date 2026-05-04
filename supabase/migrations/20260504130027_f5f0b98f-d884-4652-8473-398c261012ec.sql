CREATE OR REPLACE FUNCTION public.set_cliente_vendedor_factory_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.factory_id IS NULL THEN
    SELECT factory_id INTO NEW.factory_id FROM public.clientes WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cliente_vendedor_factory_id ON public.cliente_vendedor;
CREATE TRIGGER trg_set_cliente_vendedor_factory_id
BEFORE INSERT ON public.cliente_vendedor
FOR EACH ROW EXECUTE FUNCTION public.set_cliente_vendedor_factory_id();