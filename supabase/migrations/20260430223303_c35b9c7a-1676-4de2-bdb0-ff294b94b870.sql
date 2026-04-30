-- Update function with proper search_path for security
CREATE OR REPLACE FUNCTION public.vincular_cliente_ao_vendedor_criador()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user who inserted is a salesperson, create the relationship in cliente_vendedor
  IF public.is_vendedor(auth.uid()) THEN
    INSERT INTO public.cliente_vendedor (cliente_id, vendedor_user_id)
    VALUES (NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;