CREATE TABLE public.bebidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bebidas TO authenticated;
GRANT ALL ON public.bebidas TO service_role;
ALTER TABLE public.bebidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bebidas por fabrica" ON public.bebidas
FOR ALL TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX idx_bebidas_factory ON public.bebidas(factory_id);

CREATE TRIGGER set_bebidas_updated_at
BEFORE UPDATE ON public.bebidas
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE public.venda_bebida_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  bebida_id uuid REFERENCES public.bebidas(id) ON DELETE SET NULL,
  factory_id uuid NOT NULL,
  nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_bebida_itens TO authenticated;
GRANT ALL ON public.venda_bebida_itens TO service_role;
ALTER TABLE public.venda_bebida_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bebidas da venda por fabrica" ON public.venda_bebida_itens
FOR ALL TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX idx_venda_bebida_itens_venda ON public.venda_bebida_itens(venda_id);

CREATE TRIGGER set_venda_bebida_itens_updated_at
BEFORE UPDATE ON public.venda_bebida_itens
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();