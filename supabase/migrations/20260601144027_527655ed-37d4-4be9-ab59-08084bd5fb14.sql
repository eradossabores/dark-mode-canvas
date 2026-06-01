
-- Merge duplicate clients (by factory_id + normalized name) into the oldest canonical record
DO $$
DECLARE
  r RECORD;
  canonical_id uuid;
  dup_ids uuid[];
BEGIN
  FOR r IN
    SELECT factory_id, lower(btrim(nome)) AS nome_norm,
           array_agg(id ORDER BY created_at ASC) AS ids
    FROM public.clientes
    GROUP BY factory_id, lower(btrim(nome))
    HAVING count(*) > 1
  LOOP
    canonical_id := r.ids[1];
    dup_ids := r.ids[2:array_length(r.ids,1)];

    UPDATE public.vendas              SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.vendas_excluidas    SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.pedidos_producao    SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.alertas_financeiros SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.cliente_preco_sabor SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.cliente_tabela_preco SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.cliente_gelo_cubo_preco SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.cliente_vendedor    SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.estoque_freezer     SET cliente_id = canonical_id
      WHERE cliente_id = ANY(dup_ids)
        AND NOT EXISTS (
          SELECT 1 FROM public.estoque_freezer ef2
          WHERE ef2.cliente_id = canonical_id AND ef2.sabor_id = estoque_freezer.sabor_id
        );
    DELETE FROM public.estoque_freezer WHERE cliente_id = ANY(dup_ids);

    DELETE FROM public.clientes WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- Prevent future duplicates: unique by factory + normalized name
CREATE UNIQUE INDEX IF NOT EXISTS clientes_factory_nome_norm_uidx
  ON public.clientes (factory_id, lower(btrim(nome)));
