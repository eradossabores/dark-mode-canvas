
-- Fix venda a385d6be: 100 units should be R$ 1.99 each, total R$ 199.00
UPDATE public.venda_itens 
SET preco_unitario = 1.99, subtotal = quantidade * 1.99
WHERE venda_id = 'a385d6be-20b6-42fb-84a2-e2a86d388f84';

UPDATE public.vendas 
SET total = 99.80, updated_at = now()
WHERE id = 'a385d6be-20b6-42fb-84a2-e2a86d388f84';
