
-- 1) Replace trigger function: only Yuri uses the recurrence rule
CREATE OR REPLACE FUNCTION public.registrar_comissao_se_paga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_qtd integer := 0;
  v_recorrente boolean := false;
  v_vendedor record;
  v_calc record;
  v_yuri_id constant uuid := 'c311e314-e569-4303-96f7-e26bfe17a5f1';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(coalesce(NEW.status::text,'')) IN ('pago','paga','pago_total','quitado','quitada') THEN

    SELECT COALESCE(SUM(quantidade),0) INTO v_total_qtd
    FROM public.venda_itens WHERE venda_id = NEW.id;

    FOR v_vendedor IN
      SELECT vendedor_user_id FROM public.cliente_vendedor WHERE cliente_id = NEW.cliente_id
    LOOP
      -- Recorrência aplica-se SOMENTE para Yuri
      IF v_vendedor.vendedor_user_id = v_yuri_id THEN
        SELECT EXISTS (
          SELECT 1 FROM public.vendas v
          JOIN public.cliente_vendedor cv ON cv.cliente_id = v.cliente_id
          WHERE cv.vendedor_user_id = v_yuri_id
            AND v.cliente_id = NEW.cliente_id
            AND v.id <> NEW.id
            AND v.created_at < NEW.created_at
        ) INTO v_recorrente;
      ELSE
        v_recorrente := false;
      END IF;

      SELECT * INTO v_calc FROM public.calcular_comissao_pacote(v_total_qtd, v_recorrente);

      IF v_calc.valor_final > 0 THEN
        INSERT INTO public.comissoes_vendas
          (factory_id, venda_id, vendedor_user_id, quantidade_unidades, faixa, valor_base, recorrente, valor_comissao)
        VALUES
          (NEW.factory_id, NEW.id, v_vendedor.vendedor_user_id, v_total_qtd, v_calc.faixa, v_calc.valor_base, v_recorrente, v_calc.valor_final)
        ON CONFLICT (venda_id, vendedor_user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Backfill: recompute Yuri's existing commissions based on chronological order per client
WITH yuri_ranked AS (
  SELECT cv.id AS comissao_id,
         ROW_NUMBER() OVER (PARTITION BY v.cliente_id ORDER BY v.created_at, v.id) AS rn
  FROM public.comissoes_vendas cv
  JOIN public.vendas v ON v.id = cv.venda_id
  WHERE cv.vendedor_user_id = 'c311e314-e569-4303-96f7-e26bfe17a5f1'
)
UPDATE public.comissoes_vendas cv
SET recorrente = (yr.rn > 1),
    valor_comissao = CASE WHEN yr.rn > 1
                          THEN ROUND(cv.valor_base * 0.5, 2)
                          ELSE cv.valor_base
                     END
FROM yuri_ranked yr
WHERE cv.id = yr.comissao_id;

-- 3) Backfill: outros vendedores recebem 100% (sem recorrência)
UPDATE public.comissoes_vendas
SET recorrente = false,
    valor_comissao = valor_base
WHERE vendedor_user_id <> 'c311e314-e569-4303-96f7-e26bfe17a5f1'
  AND recorrente = true;
