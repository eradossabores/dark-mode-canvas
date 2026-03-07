-- Fix the VILE CLUB sale from today that used wrong price tier (R$3.99 instead of R$2.50)
-- Sale ID: fdf27eab-7398-4f7c-a6ac-560a685324ec, 50 total units should be R$2.50 each
UPDATE public.venda_itens 
SET preco_unitario = 2.50, subtotal = 2.50 * quantidade
WHERE venda_id = 'fdf27eab-7398-4f7c-a6ac-560a685324ec';

UPDATE public.vendas 
SET total = (SELECT SUM(subtotal) FROM public.venda_itens WHERE venda_id = 'fdf27eab-7398-4f7c-a6ac-560a685324ec')
WHERE id = 'fdf27eab-7398-4f7c-a6ac-560a685324ec';