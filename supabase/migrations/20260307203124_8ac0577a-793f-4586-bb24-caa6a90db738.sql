
-- Fix total: 5 items x 20 qty x 1.99 = 5 x 39.80 = 199.00
UPDATE public.vendas SET total = 199.00, updated_at = now()
WHERE id = 'a385d6be-20b6-42fb-84a2-e2a86d388f84';
