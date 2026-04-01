
CREATE TABLE public.vendas_excluidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL,
  cliente_id uuid,
  cliente_nome text,
  total numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  status text,
  operador text,
  observacoes text,
  numero_nf text,
  valor_pago numeric DEFAULT 0,
  valor_pix numeric DEFAULT 0,
  valor_especie numeric DEFAULT 0,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  parcelas jsonb DEFAULT '[]'::jsonb,
  data_venda timestamp with time zone,
  excluido_em timestamp with time zone NOT NULL DEFAULT now(),
  excluido_por text DEFAULT 'sistema',
  factory_id uuid REFERENCES public.factories(id),
  motivo text
);

ALTER TABLE public.vendas_excluidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage vendas_excluidas"
  ON public.vendas_excluidas
  FOR ALL
  TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));
