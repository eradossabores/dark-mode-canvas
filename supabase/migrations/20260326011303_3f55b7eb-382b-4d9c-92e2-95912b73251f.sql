CREATE TABLE public.factory_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  quantidade_minima integer NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL DEFAULT 4.99,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.factory_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON public.factory_pricing_tiers FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX factory_pricing_tiers_factory_qty ON public.factory_pricing_tiers(factory_id, quantidade_minima);