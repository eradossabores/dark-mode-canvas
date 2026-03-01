
-- Table for public portal orders (staging before approval)
CREATE TABLE public.pedidos_publicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  telefone TEXT NOT NULL,
  endereco TEXT NOT NULL,
  bairro TEXT NOT NULL,
  forma_pagamento TEXT NOT NULL DEFAULT 'pix',
  observacoes TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_itens INTEGER NOT NULL DEFAULT 0,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 4.99,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pedidos_publicos ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public portal, no auth)
CREATE POLICY "Public can insert orders"
  ON public.pedidos_publicos
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated users can read/update/delete
CREATE POLICY "Authenticated can read orders"
  ON public.pedidos_publicos
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update orders"
  ON public.pedidos_publicos
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete orders"
  ON public.pedidos_publicos
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_publicos;
