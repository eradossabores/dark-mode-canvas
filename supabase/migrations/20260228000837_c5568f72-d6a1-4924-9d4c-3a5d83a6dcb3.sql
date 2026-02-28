
CREATE TABLE public.abatimentos_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.abatimentos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON public.abatimentos_historico FOR ALL USING (true) WITH CHECK (true);
