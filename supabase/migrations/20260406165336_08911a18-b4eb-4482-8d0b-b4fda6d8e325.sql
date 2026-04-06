
-- Add toggle to factories
ALTER TABLE public.factories ADD COLUMN vende_gelo_cubo boolean NOT NULL DEFAULT false;

-- Pricing per size per factory
CREATE TABLE public.gelo_cubo_precos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE NOT NULL,
  tamanho text NOT NULL, -- '2kg', '4kg', '5kg'
  preco numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id, tamanho)
);

ALTER TABLE public.gelo_cubo_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage gelo_cubo_precos"
ON public.gelo_cubo_precos FOR ALL TO authenticated
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Sales line items for cubed ice
CREATE TABLE public.venda_gelo_cubo_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE CASCADE NOT NULL,
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  tamanho text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venda_gelo_cubo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage venda_gelo_cubo_itens"
ON public.venda_gelo_cubo_itens FOR ALL TO authenticated
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger for updated_at on precos
CREATE TRIGGER update_gelo_cubo_precos_updated_at
BEFORE UPDATE ON public.gelo_cubo_precos
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
