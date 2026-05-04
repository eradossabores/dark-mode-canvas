UPDATE public.cliente_vendedor cv
SET factory_id = c.factory_id
FROM public.clientes c
WHERE cv.cliente_id = c.id AND cv.factory_id IS NULL;