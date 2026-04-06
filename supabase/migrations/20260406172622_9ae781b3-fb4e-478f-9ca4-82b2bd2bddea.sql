
CREATE TABLE public.cliente_gelo_cubo_preco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES public.factories(id),
  tamanho TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, tamanho)
);

ALTER TABLE public.cliente_gelo_cubo_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage cliente_gelo_cubo_preco"
  ON public.cliente_gelo_cubo_preco
  FOR ALL
  TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));
