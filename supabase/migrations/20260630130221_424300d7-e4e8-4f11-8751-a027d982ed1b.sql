UPDATE public.vendas
SET valor_original = total
WHERE factory_id='00000000-0000-0000-0000-000000000001'
  AND cliente_id IN (SELECT id FROM public.clientes WHERE nome ILIKE 'smoke' AND factory_id='00000000-0000-0000-0000-000000000001')
  AND status='pendente'
  AND valor_original IS DISTINCT FROM total;