
-- Enum for order status
CREATE TYPE public.status_pedido_producao AS ENUM (
  'aguardando_producao',
  'em_producao',
  'separado_para_entrega',
  'enviado'
);

-- Main orders table
CREATE TABLE public.pedidos_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  status public.status_pedido_producao NOT NULL DEFAULT 'aguardando_producao',
  tipo_embalagem TEXT NOT NULL DEFAULT 'padrão',
  data_entrega TIMESTAMP WITH TIME ZONE NOT NULL,
  observacoes TEXT,
  operador TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order items (flavors + quantities)
CREATE TABLE public.pedido_producao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos_producao(id) ON DELETE CASCADE,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0)
);

-- Enable RLS
ALTER TABLE public.pedidos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_producao_itens ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth system)
CREATE POLICY "Allow all access to pedidos_producao" ON public.pedidos_producao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pedido_producao_itens" ON public.pedido_producao_itens FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_pedidos_producao_updated_at
  BEFORE UPDATE ON public.pedidos_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Enable realtime for monitor
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_producao;
