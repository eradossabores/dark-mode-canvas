ALTER TABLE public.abatimentos_historico 
ADD COLUMN forma_pagamento text NOT NULL DEFAULT 'especie',
ADD COLUMN valor_pix numeric DEFAULT 0,
ADD COLUMN valor_especie numeric DEFAULT 0;