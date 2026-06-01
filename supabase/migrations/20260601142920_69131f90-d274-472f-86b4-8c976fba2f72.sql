
-- ============ CLIENTES: novos campos financeiros ============
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS preco_unidade_avista numeric(10,2),
  ADD COLUMN IF NOT EXISTS preco_unidade_aprazo numeric(10,2) DEFAULT 2.05,
  ADD COLUMN IF NOT EXISTS limite_credito numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_devedor_atual numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_financeiro text NOT NULL DEFAULT 'adimplente',
  ADD COLUMN IF NOT EXISTS conversao_automatica_prazo boolean NOT NULL DEFAULT false;

-- Backfill preco_unidade_aprazo p/ clientes existentes
UPDATE public.clientes SET preco_unidade_aprazo = 2.05 WHERE preco_unidade_aprazo IS NULL;

-- ============ VENDAS: campos de forma de pagamento / conversão ============
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS forma_pagamento_tipo text NOT NULL DEFAULT 'avista',
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS convertida_automaticamente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_conversao timestamptz,
  ADD COLUMN IF NOT EXISTS valor_original numeric(12,2),
  ADD COLUMN IF NOT EXISTS preco_unitario_usado numeric(10,2);

UPDATE public.vendas SET valor_original = total WHERE valor_original IS NULL;

-- ============ ALERTAS FINANCEIROS ============
CREATE TABLE IF NOT EXISTS public.alertas_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL,
  cliente_id uuid,
  venda_id uuid,
  tipo text NOT NULL, -- vence_hoje | vencida_1d | vencida_2d | convertida | acima_limite
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_financeiros TO authenticated;
GRANT ALL ON public.alertas_financeiros TO service_role;

ALTER TABLE public.alertas_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users manage alertas_financeiros"
ON public.alertas_financeiros
FOR ALL TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_alertas_fin_factory ON public.alertas_financeiros(factory_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerta_venda_tipo ON public.alertas_financeiros(venda_id, tipo) WHERE venda_id IS NOT NULL;

-- ============ FUNÇÃO: recalcular saldo devedor ============
CREATE OR REPLACE FUNCTION public.recalcular_saldo_devedor(_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric(12,2);
  v_limite numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(v.total),0) - COALESCE((
    SELECT SUM(ah.valor) FROM abatimentos_historico ah
    JOIN vendas vv ON vv.id = ah.venda_id
    WHERE vv.cliente_id = _cliente_id
  ),0)
  INTO v_saldo
  FROM vendas v
  WHERE v.cliente_id = _cliente_id;

  SELECT limite_credito INTO v_limite FROM clientes WHERE id = _cliente_id;

  UPDATE clientes
  SET saldo_devedor_atual = GREATEST(v_saldo, 0),
      status_financeiro = CASE
        WHEN COALESCE(v_limite,0) > 0 AND v_saldo > v_limite THEN 'inadimplente'
        WHEN EXISTS (
          SELECT 1 FROM vendas v2
          WHERE v2.cliente_id = _cliente_id
            AND v2.data_vencimento IS NOT NULL
            AND v2.data_vencimento < CURRENT_DATE
            AND COALESCE(v2.total,0) > COALESCE((SELECT SUM(ah2.valor) FROM abatimentos_historico ah2 WHERE ah2.venda_id = v2.id),0)
        ) THEN 'inadimplente'
        ELSE 'adimplente'
      END
  WHERE id = _cliente_id;
END;
$$;

-- Trigger helper
CREATE OR REPLACE FUNCTION public.trg_recalc_saldo_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_saldo_devedor(COALESCE(NEW.cliente_id, OLD.cliente_id));
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS trg_vendas_recalc_saldo ON public.vendas;
CREATE TRIGGER trg_vendas_recalc_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_saldo_venda();

CREATE OR REPLACE FUNCTION public.trg_recalc_saldo_abatimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli uuid;
BEGIN
  SELECT cliente_id INTO v_cli FROM vendas WHERE id = COALESCE(NEW.venda_id, OLD.venda_id);
  IF v_cli IS NOT NULL THEN PERFORM public.recalcular_saldo_devedor(v_cli); END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS trg_abatimentos_recalc_saldo ON public.abatimentos_historico;
CREATE TRIGGER trg_abatimentos_recalc_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.abatimentos_historico
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_saldo_abatimento();

-- ============ CONVERSÃO AUTOMÁTICA + ALERTAS DIÁRIOS ============
CREATE OR REPLACE FUNCTION public.processar_conversoes_e_alertas_diarios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda RECORD;
  v_qtd_itens integer;
  v_novo_preco numeric(10,2);
  v_novo_total numeric(12,2);
  v_convertidas integer := 0;
  v_alertas integer := 0;
BEGIN
  -- 1) Converter vendas à vista atrasadas (> 3 dias) para clientes opt-in
  FOR v_venda IN
    SELECT v.*, c.preco_unidade_aprazo, c.nome AS cliente_nome
    FROM vendas v
    JOIN clientes c ON c.id = v.cliente_id
    WHERE v.forma_pagamento_tipo = 'avista'
      AND v.convertida_automaticamente = false
      AND c.conversao_automatica_prazo = true
      AND v.created_at::date <= CURRENT_DATE - INTERVAL '3 days'
      AND COALESCE(v.total,0) > COALESCE((SELECT SUM(ah.valor) FROM abatimentos_historico ah WHERE ah.venda_id = v.id),0)
  LOOP
    SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_itens FROM venda_itens WHERE venda_id = v_venda.id;
    v_novo_preco := COALESCE(v_venda.preco_unidade_aprazo, 2.05);
    v_novo_total := v_novo_preco * v_qtd_itens;

    UPDATE vendas
    SET forma_pagamento_tipo = 'aprazo',
        convertida_automaticamente = true,
        data_conversao = now(),
        valor_original = COALESCE(valor_original, total),
        total = v_novo_total,
        preco_unitario_usado = v_novo_preco
    WHERE id = v_venda.id;

    UPDATE venda_itens
    SET preco_unitario = v_novo_preco,
        subtotal = v_novo_preco * quantidade
    WHERE venda_id = v_venda.id;

    INSERT INTO alertas_financeiros(factory_id, cliente_id, venda_id, tipo, mensagem)
    VALUES (v_venda.factory_id, v_venda.cliente_id, v_venda.id, 'convertida',
      format('Venda de %s convertida automaticamente para A Prazo. Novo total: R$ %s', v_venda.cliente_nome, v_novo_total))
    ON CONFLICT (venda_id, tipo) DO NOTHING;

    INSERT INTO auditoria(modulo, acao, usuario_nome, registro_afetado, descricao, factory_id)
    VALUES ('vendas','conversao_automatica','sistema',v_venda.id,
      format('Venda convertida À Vista→A Prazo (R$ %s → R$ %s) cliente %s', v_venda.valor_original, v_novo_total, v_venda.cliente_nome),
      v_venda.factory_id);

    v_convertidas := v_convertidas + 1;
  END LOOP;

  -- 2) Alertas de vencimento (vence hoje / vencida 1d / vencida 2d)
  FOR v_venda IN
    SELECT v.id, v.factory_id, v.cliente_id, v.data_vencimento, c.nome AS cliente_nome, v.total,
           COALESCE((SELECT SUM(ah.valor) FROM abatimentos_historico ah WHERE ah.venda_id = v.id),0) AS pago
    FROM vendas v JOIN clientes c ON c.id = v.cliente_id
    WHERE v.data_vencimento IS NOT NULL
      AND v.data_vencimento BETWEEN CURRENT_DATE - INTERVAL '2 days' AND CURRENT_DATE
  LOOP
    IF v_venda.total <= v_venda.pago THEN CONTINUE; END IF;
    DECLARE v_tipo text; v_msg text;
    BEGIN
      IF v_venda.data_vencimento = CURRENT_DATE THEN
        v_tipo := 'vence_hoje';
        v_msg := format('Venda de %s vence hoje (R$ %s)', v_venda.cliente_nome, v_venda.total - v_venda.pago);
      ELSIF v_venda.data_vencimento = CURRENT_DATE - 1 THEN
        v_tipo := 'vencida_1d';
        v_msg := format('Venda de %s vencida há 1 dia (R$ %s)', v_venda.cliente_nome, v_venda.total - v_venda.pago);
      ELSE
        v_tipo := 'vencida_2d';
        v_msg := format('Venda de %s vencida há 2 dias (R$ %s)', v_venda.cliente_nome, v_venda.total - v_venda.pago);
      END IF;
      INSERT INTO alertas_financeiros(factory_id, cliente_id, venda_id, tipo, mensagem)
      VALUES (v_venda.factory_id, v_venda.cliente_id, v_venda.id, v_tipo, v_msg)
      ON CONFLICT (venda_id, tipo) DO NOTHING;
      v_alertas := v_alertas + 1;
    END;
  END LOOP;

  -- 3) Alertas de cliente acima do limite
  INSERT INTO alertas_financeiros(factory_id, cliente_id, tipo, mensagem)
  SELECT factory_id, id, 'acima_limite',
    format('Cliente %s está com saldo R$ %s acima do limite de R$ %s', nome, saldo_devedor_atual, limite_credito)
  FROM clientes
  WHERE limite_credito > 0 AND saldo_devedor_atual > limite_credito
    AND NOT EXISTS (
      SELECT 1 FROM alertas_financeiros a
      WHERE a.cliente_id = clientes.id AND a.tipo = 'acima_limite'
        AND a.created_at::date = CURRENT_DATE
    );

  RETURN jsonb_build_object('convertidas', v_convertidas, 'alertas', v_alertas);
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_conversoes_e_alertas_diarios() TO authenticated, service_role;

-- ============ CRON DIÁRIO ============
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'conversoes-prazo-diaria') THEN
    PERFORM cron.unschedule('conversoes-prazo-diaria');
  END IF;
  PERFORM cron.schedule(
    'conversoes-prazo-diaria',
    '0 6 * * *', -- 03:00 BRT
    $cron$ SELECT public.processar_conversoes_e_alertas_diarios(); $cron$
  );
END $$;
