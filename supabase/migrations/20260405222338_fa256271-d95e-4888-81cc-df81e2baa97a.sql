
-- Tabela principal de planos semanais
CREATE TABLE public.planos_semanais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID REFERENCES public.factories(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Plano Semanal',
  semana_inicio DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planos_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage planos_semanais"
ON public.planos_semanais FOR ALL TO authenticated
USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Itens do plano semanal
CREATE TABLE public.plano_semanal_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id UUID NOT NULL REFERENCES public.planos_semanais(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES public.factories(id) ON DELETE CASCADE,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL, -- 0=dom, 1=seg ... 6=sab
  quantidade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plano_semanal_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage plano_semanal_itens"
ON public.plano_semanal_itens FOR ALL TO authenticated
USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_planos_semanais_updated_at
BEFORE UPDATE ON public.planos_semanais
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
