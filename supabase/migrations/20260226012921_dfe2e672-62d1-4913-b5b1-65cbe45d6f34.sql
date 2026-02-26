
ALTER TABLE public.contas_a_pagar ADD COLUMN pago_mes BOOLEAN NOT NULL DEFAULT false;

-- Essencia André já pagou a parcela do mês
UPDATE contas_a_pagar SET pago_mes = true WHERE descricao = 'ESSENCIA' AND responsavel = 'André';
