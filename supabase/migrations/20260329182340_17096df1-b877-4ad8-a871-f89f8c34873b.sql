-- Add saco configuration to factories
ALTER TABLE public.factories 
  ADD COLUMN usa_sacos boolean NOT NULL DEFAULT false,
  ADD COLUMN unidades_por_saco integer NOT NULL DEFAULT 50;

-- Create separate saco stock table
CREATE TABLE public.estoque_sacos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id)
);

ALTER TABLE public.estoque_sacos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_estoque_sacos" ON public.estoque_sacos
  FOR ALL USING (true) WITH CHECK (true);