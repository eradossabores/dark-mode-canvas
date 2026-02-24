-- Create follow-up messages table
CREATE TABLE public.followup_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID NOT NULL REFERENCES public.prospectos(id) ON DELETE CASCADE,
  visita_id UUID REFERENCES public.prospecto_visitas(id) ON DELETE SET NULL,
  mensagem_gerada TEXT NOT NULL,
  mensagem_editada TEXT,
  tom TEXT DEFAULT 'informal',
  data_agendada DATE NOT NULL,
  data_envio TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pendente',
  resposta_cliente TEXT,
  resultado TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON public.followup_mensagens FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_followup_mensagens_updated_at
  BEFORE UPDATE ON public.followup_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();