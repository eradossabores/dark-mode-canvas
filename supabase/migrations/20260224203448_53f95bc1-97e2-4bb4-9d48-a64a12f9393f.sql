
-- Enum for prospect status
CREATE TYPE public.status_prospecto AS ENUM ('novo', 'visitado', 'interessado', 'pedido_fechado', 'retornar', 'sem_interesse');

-- Enum for prospect type
CREATE TYPE public.tipo_prospecto AS ENUM ('bar', 'tabacaria', 'distribuidora', 'casa_noturna', 'evento_buffet', 'restaurante_lounge', 'lanchonete', 'mercado', 'outro');

-- Enum for priority
CREATE TYPE public.prioridade_prospecto AS ENUM ('alta', 'media', 'baixa');

-- Main prospects table
CREATE TABLE public.prospectos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo public.tipo_prospecto NOT NULL DEFAULT 'outro',
  bairro TEXT,
  endereco TEXT,
  telefone TEXT,
  contato_nome TEXT,
  prioridade public.prioridade_prospecto NOT NULL DEFAULT 'media',
  status public.status_prospecto NOT NULL DEFAULT 'novo',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  observacoes_estrategicas TEXT,
  volume_potencial TEXT,
  perfil_publico TEXT,
  script_abordagem TEXT,
  operador TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Visit history table
CREATE TABLE public.prospecto_visitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID NOT NULL REFERENCES public.prospectos(id) ON DELETE CASCADE,
  data_visita TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resultado public.status_prospecto NOT NULL,
  produto_apresentado TEXT,
  feedback TEXT,
  proxima_acao TEXT,
  operador TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecto_visitas ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin-only via has_role check)
CREATE POLICY "Admins can manage prospectos" ON public.prospectos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage prospecto_visitas" ON public.prospecto_visitas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER set_prospectos_updated_at
  BEFORE UPDATE ON public.prospectos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Index for geographic queries
CREATE INDEX idx_prospectos_location ON public.prospectos (latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_prospectos_bairro ON public.prospectos (bairro);
CREATE INDEX idx_prospectos_status ON public.prospectos (status);
