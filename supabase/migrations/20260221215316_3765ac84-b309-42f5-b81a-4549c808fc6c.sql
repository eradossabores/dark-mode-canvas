
ALTER TABLE public.producao_funcionarios DROP CONSTRAINT IF EXISTS producao_funcionarios_quantidade_produzida_check;

ALTER TABLE public.producao_funcionarios ALTER COLUMN quantidade_produzida SET DEFAULT 0;

NOTIFY pgrst, 'reload schema';
