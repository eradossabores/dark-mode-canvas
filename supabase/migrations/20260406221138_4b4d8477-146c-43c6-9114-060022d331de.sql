-- Add NFE config to factories
ALTER TABLE public.factories 
ADD COLUMN IF NOT EXISTS emite_nfe boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS nfe_api_key text NULL,
ADD COLUMN IF NOT EXISTS nfe_company_id text NULL;

-- Create notas_fiscais table
CREATE TABLE public.notas_fiscais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  numero text NULL,
  serie text NULL DEFAULT '1',
  chave_acesso text NULL,
  status text NOT NULL DEFAULT 'processando',
  nfe_io_id text NULL,
  pdf_url text NULL,
  xml_url text NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  erro_mensagem text NULL,
  cliente_nome text NULL,
  cliente_cpf_cnpj text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Factory users can manage notas_fiscais"
ON public.notas_fiscais
FOR ALL
TO authenticated
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_notas_fiscais_updated_at
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();