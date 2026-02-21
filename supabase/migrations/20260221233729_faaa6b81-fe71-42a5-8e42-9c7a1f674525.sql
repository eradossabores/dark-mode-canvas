
ALTER TABLE public.vendas ADD COLUMN forma_pagamento text NOT NULL DEFAULT 'dinheiro';

NOTIFY pgrst, 'reload schema';
