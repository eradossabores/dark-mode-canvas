ALTER TABLE public.fornecedores ADD COLUMN tipo text NOT NULL DEFAULT 'insumo';

UPDATE public.fornecedores SET tipo = 'insumo' WHERE nome IN ('MSD', 'TEC SABOR', 'FLAVORS');