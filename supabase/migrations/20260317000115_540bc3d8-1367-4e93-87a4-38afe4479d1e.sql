CREATE TABLE public.presenca_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  confirmado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, data)
);

ALTER TABLE public.presenca_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access presenca" ON public.presenca_producao
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);