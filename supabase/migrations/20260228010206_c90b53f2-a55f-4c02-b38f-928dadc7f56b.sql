
CREATE TABLE public.avarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id),
  quantidade INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  operador TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_avarias" ON public.avarias FOR ALL USING (true) WITH CHECK (true);
