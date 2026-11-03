CREATE OR REPLACE FUNCTION public.recalcular_saldo_devedor(_cliente_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo numeric(12,2);
  v_limite numeric(12,2);
BEGIN
  -- Mesma regra dos relatórios: ignora canceladas e vendas pagas;
  -- nas demais, saldo = total - max(abatimentos, valor_pago).
  SELECT COALESCE(SUM(GREATEST(0, v.total - GREATEST(
           COALESCE((SELECT SUM(ah.valor) FROM abatimentos_historico ah WHERE ah.venda_id = v.id),0),
           COALESCE(v.valor_pago,0)))),0)
  INTO v_saldo
  FROM vendas v
  WHERE v.cliente_id = _cliente_id AND v.status NOT IN ('cancelada','paga');

  SELECT limite_credito INTO v_limite FROM clientes WHERE id = _cliente_id;

  UPDATE clientes
  SET saldo_devedor_atual = v_saldo,
      status_financeiro = CASE
        WHEN COALESCE(v_limite,0) > 0 AND v_saldo > v_limite THEN 'inadimplente'
        WHEN EXISTS (
          SELECT 1 FROM vendas v2
          WHERE v2.cliente_id = _cliente_id
            AND v2.status NOT IN ('cancelada','paga')
            AND v2.data_vencimento IS NOT NULL
            AND v2.data_vencimento < CURRENT_DATE
            AND COALESCE(v2.total,0) > GREATEST(COALESCE((SELECT SUM(ah2.valor) FROM abatimentos_historico ah2 WHERE ah2.venda_id = v2.id),0), COALESCE(v2.valor_pago,0))
        ) THEN 'inadimplente'
        ELSE 'adimplente'
      END
  WHERE id = _cliente_id;
END;
$function$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.clientes LOOP PERFORM public.recalcular_saldo_devedor(r.id); END LOOP;
END $$;