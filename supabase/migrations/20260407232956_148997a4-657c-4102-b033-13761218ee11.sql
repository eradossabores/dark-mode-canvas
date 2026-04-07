
-- Add categoria column to contas_a_pagar
ALTER TABLE public.contas_a_pagar 
ADD COLUMN categoria text NOT NULL DEFAULT 'outros';

-- Create payment history table
CREATE TABLE public.pagamentos_contas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES public.contas_a_pagar(id) ON DELETE CASCADE,
  factory_id uuid REFERENCES public.factories(id),
  valor numeric NOT NULL DEFAULT 0,
  forma_pagamento text NOT NULL DEFAULT 'pix',
  data_pagamento timestamp with time zone NOT NULL DEFAULT now(),
  parcela_numero integer,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_contas ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Factory users can manage pagamentos_contas"
ON public.pagamentos_contas
FOR ALL
TO authenticated
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));
