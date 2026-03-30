
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS setor text NOT NULL DEFAULT 'producao';
COMMENT ON COLUMN public.funcionarios.setor IS 'Setor do colaborador: producao ou vendas';
