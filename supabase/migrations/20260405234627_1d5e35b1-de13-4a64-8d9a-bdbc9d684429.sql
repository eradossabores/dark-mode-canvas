
CREATE TABLE public.video_aulas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  url_video TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  ordem INT NOT NULL DEFAULT 0,
  factory_id TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_aulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view video_aulas"
ON public.video_aulas FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Super admins can manage video_aulas"
ON public.video_aulas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
