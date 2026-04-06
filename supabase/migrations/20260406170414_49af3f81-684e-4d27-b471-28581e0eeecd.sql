
CREATE TABLE public.estoque_gelo_cubo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  tamanho TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (factory_id, tamanho)
);

ALTER TABLE public.estoque_gelo_cubo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage estoque_gelo_cubo"
ON public.estoque_gelo_cubo
FOR ALL
TO authenticated
USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));
