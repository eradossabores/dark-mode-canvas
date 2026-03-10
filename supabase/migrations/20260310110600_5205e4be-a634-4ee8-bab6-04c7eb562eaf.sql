-- Fix: Update movimentacao to reflect actual production of 336 instead of 84
UPDATE movimentacoes_estoque 
SET quantidade = 336 
WHERE referencia_id = '364a6890-43a9-4214-9840-1a0b4c37a736' 
AND tipo_item = 'gelo_pronto' AND tipo_movimentacao = 'entrada';

-- Fix: Add the missing 252 units (336 - 84) to estoque_gelos for Melancia
UPDATE estoque_gelos 
SET quantidade = quantidade + 252, updated_at = now() 
WHERE sabor_id = 'c0000001-0000-0000-0000-000000000001';