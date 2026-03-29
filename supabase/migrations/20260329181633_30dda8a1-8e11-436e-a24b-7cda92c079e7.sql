-- Fix existing pedidos_producao missing factory_id from vendas
UPDATE pedidos_producao pp
SET factory_id = v.factory_id
FROM vendas v
WHERE pp.venda_id = v.id AND pp.factory_id IS NULL AND v.factory_id IS NOT NULL;

-- Fix pedidos_producao missing factory_id from clientes
UPDATE pedidos_producao pp
SET factory_id = c.factory_id
FROM clientes c
WHERE pp.cliente_id = c.id AND pp.factory_id IS NULL AND c.factory_id IS NOT NULL;

-- Fix pedido_producao_itens missing factory_id
UPDATE pedido_producao_itens ppi
SET factory_id = pp.factory_id
FROM pedidos_producao pp
WHERE ppi.pedido_id = pp.id AND ppi.factory_id IS NULL AND pp.factory_id IS NOT NULL;