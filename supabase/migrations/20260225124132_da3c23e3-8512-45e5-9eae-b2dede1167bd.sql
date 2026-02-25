-- Add tipo_pedido column (entrega or retirada) and venda_id reference to pedidos_producao
ALTER TABLE public.pedidos_producao 
  ADD COLUMN IF NOT EXISTS tipo_pedido text NOT NULL DEFAULT 'entrega',
  ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL;

-- Add enviado_producao flag to vendas for tracking duplicate sends
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS enviado_producao boolean NOT NULL DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pedidos_producao_venda_id ON public.pedidos_producao(venda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_producao_tipo_pedido ON public.pedidos_producao(tipo_pedido);