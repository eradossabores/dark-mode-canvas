CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id),
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'outros',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  data_despesa date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'pix',
  pago boolean NOT NULL DEFAULT true,
  responsavel text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage despesas"
ON public.despesas FOR ALL TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX idx_despesas_factory_data ON public.despesas (factory_id, data_despesa DESC);

CREATE TRIGGER set_updated_at_despesas
BEFORE UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();