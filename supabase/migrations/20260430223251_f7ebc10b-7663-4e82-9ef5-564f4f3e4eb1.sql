-- Function to automatically link a newly created client to the salesperson who created it
CREATE OR REPLACE FUNCTION public.vincular_cliente_ao_vendedor_criador()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user who inserted is a salesperson, create the relationship in cliente_vendedor
  IF is_vendedor(auth.uid()) THEN
    INSERT INTO public.cliente_vendedor (cliente_id, vendedor_user_id)
    VALUES (NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the link after client insertion
DROP TRIGGER IF EXISTS tr_vincular_vendedor_cliente ON public.clientes;
CREATE TRIGGER tr_vincular_vendedor_cliente
AFTER INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.vincular_cliente_ao_vendedor_criador();