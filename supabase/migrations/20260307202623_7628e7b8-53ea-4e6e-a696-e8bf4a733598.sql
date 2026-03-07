
-- Fix the stock for the mismatched production edit:
-- Subtract 84 from Água de Coco (was incorrectly kept)
UPDATE public.estoque_gelos SET quantidade = quantidade - 84, updated_at = now()
WHERE sabor_id = 'c0000001-0000-0000-0000-000000000003';

-- Add 84 to Abacaxi com Hortelã (was never added)
UPDATE public.estoque_gelos SET quantidade = quantidade + 84, updated_at = now()
WHERE sabor_id = 'c0000001-0000-0000-0000-000000000007';

-- Fix the movimentacao to point to correct sabor
UPDATE public.movimentacoes_estoque 
SET item_id = 'c0000001-0000-0000-0000-000000000007'
WHERE referencia_id = 'f98bd5d8-189e-4e51-bdbb-bc8451809888';
