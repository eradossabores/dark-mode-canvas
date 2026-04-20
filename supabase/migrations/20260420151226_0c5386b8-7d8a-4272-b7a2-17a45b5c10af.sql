-- =========================================================
-- 1. Tabela de vínculo cliente <-> vendedor
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cliente_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  vendedor_user_id uuid NOT NULL,
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, vendedor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_vendedor_vendedor ON public.cliente_vendedor(vendedor_user_id);
CREATE INDEX IF NOT EXISTS idx_cliente_vendedor_cliente ON public.cliente_vendedor(cliente_id);

ALTER TABLE public.cliente_vendedor ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: o cliente pertence ao vendedor logado?
CREATE OR REPLACE FUNCTION public.cliente_pertence_ao_vendedor(_cliente_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cliente_vendedor
    WHERE cliente_id = _cliente_id AND vendedor_user_id = _user_id
  );
$$;

-- Função auxiliar: usuário tem role 'vendedor'?
CREATE OR REPLACE FUNCTION public.is_vendedor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'vendedor'
  );
$$;

-- RLS: vendedores veem só os próprios vínculos; donos/admins veem tudo da fábrica
CREATE POLICY "Vendedor vê próprios vínculos"
  ON public.cliente_vendedor FOR SELECT TO authenticated
  USING (
    vendedor_user_id = auth.uid()
    OR factory_id = get_user_factory_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Factory pode gerir vínculos"
  ON public.cliente_vendedor FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Trigger: ao cadastrar cliente, se for vendedor, vincula automaticamente
CREATE OR REPLACE FUNCTION public.auto_vincular_vendedor_ao_cliente()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_vendedor(auth.uid()) THEN
    INSERT INTO public.cliente_vendedor (cliente_id, vendedor_user_id, factory_id)
    VALUES (NEW.id, auth.uid(), NEW.factory_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vincular_vendedor ON public.clientes;
CREATE TRIGGER trg_auto_vincular_vendedor
  AFTER INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.auto_vincular_vendedor_ao_cliente();

-- =========================================================
-- 2. Ajustar RLS de CLIENTES para vendedor ver só os seus
-- =========================================================
DROP POLICY IF EXISTS "Factory users can manage clientes" ON public.clientes;

CREATE POLICY "Acesso a clientes por vínculo ou fábrica"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      factory_id = get_user_factory_id(auth.uid())
      AND (
        NOT public.is_vendedor(auth.uid())
        OR public.cliente_pertence_ao_vendedor(id, auth.uid())
      )
    )
  );

CREATE POLICY "Inserir cliente na própria fábrica"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR factory_id = get_user_factory_id(auth.uid())
  );

CREATE POLICY "Atualizar cliente da própria fábrica/vendedor"
  ON public.clientes FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      factory_id = get_user_factory_id(auth.uid())
      AND (
        NOT public.is_vendedor(auth.uid())
        OR public.cliente_pertence_ao_vendedor(id, auth.uid())
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR factory_id = get_user_factory_id(auth.uid())
  );

CREATE POLICY "Apagar cliente apenas admins/donos"
  ON public.clientes FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (factory_id = get_user_factory_id(auth.uid()) AND NOT public.is_vendedor(auth.uid()))
  );

-- =========================================================
-- 3. Ajustar RLS de VENDAS: vendedor só vê as próprias
-- =========================================================
DROP POLICY IF EXISTS "Factory users can manage vendas" ON public.vendas;

CREATE POLICY "Acesso a vendas por vínculo ou fábrica"
  ON public.vendas FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      factory_id = get_user_factory_id(auth.uid())
      AND (
        NOT public.is_vendedor(auth.uid())
        OR public.cliente_pertence_ao_vendedor(cliente_id, auth.uid())
      )
    )
  );

CREATE POLICY "Inserir venda na própria fábrica"
  ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      factory_id = get_user_factory_id(auth.uid())
      AND (
        NOT public.is_vendedor(auth.uid())
        OR public.cliente_pertence_ao_vendedor(cliente_id, auth.uid())
      )
    )
  );

CREATE POLICY "Atualizar venda própria/fábrica"
  ON public.vendas FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      factory_id = get_user_factory_id(auth.uid())
      AND (
        NOT public.is_vendedor(auth.uid())
        OR public.cliente_pertence_ao_vendedor(cliente_id, auth.uid())
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR factory_id = get_user_factory_id(auth.uid())
  );

CREATE POLICY "Apagar venda apenas admins/donos"
  ON public.vendas FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (factory_id = get_user_factory_id(auth.uid()) AND NOT public.is_vendedor(auth.uid()))
  );

-- =========================================================
-- 4. Tabela de comissões por venda
-- =========================================================
CREATE TABLE IF NOT EXISTS public.comissoes_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  vendedor_user_id uuid NOT NULL,
  quantidade_unidades integer NOT NULL DEFAULT 0,
  faixa text NOT NULL,                 -- '100','200','300','400+'
  valor_base numeric(10,2) NOT NULL,   -- valor cheio da faixa
  recorrente boolean NOT NULL DEFAULT false,
  valor_comissao numeric(10,2) NOT NULL, -- valor final (50% se recorrente)
  status text NOT NULL DEFAULT 'pendente', -- pendente | paga
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venda_id, vendedor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor ON public.comissoes_vendas(vendedor_user_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_factory ON public.comissoes_vendas(factory_id);

ALTER TABLE public.comissoes_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor vê próprias comissões"
  ON public.comissoes_vendas FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR vendedor_user_id = auth.uid()
    OR (factory_id = get_user_factory_id(auth.uid()) AND NOT public.is_vendedor(auth.uid()))
  );

CREATE POLICY "Factory pode gerir comissões"
  ON public.comissoes_vendas FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- =========================================================
-- 5. Tabela de bônus por meta mensal
-- =========================================================
CREATE TABLE IF NOT EXISTS public.bonus_metas_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  vendedor_user_id uuid NOT NULL,
  mes_referencia date NOT NULL, -- primeiro dia do mês
  unidades_vendidas integer NOT NULL DEFAULT 0,
  valor_bonus numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendedor_user_id, mes_referencia)
);

ALTER TABLE public.bonus_metas_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor vê próprios bônus"
  ON public.bonus_metas_vendedor FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR vendedor_user_id = auth.uid()
    OR (factory_id = get_user_factory_id(auth.uid()) AND NOT public.is_vendedor(auth.uid()))
  );

CREATE POLICY "Factory pode gerir bônus"
  ON public.bonus_metas_vendedor FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_bonus_updated_at
  BEFORE UPDATE ON public.bonus_metas_vendedor
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =========================================================
-- 6. Tabela de ajuda de custo semanal
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ajuda_custo_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  vendedor_user_id uuid NOT NULL,
  semana_inicio date NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 80.00,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendedor_user_id, semana_inicio)
);

ALTER TABLE public.ajuda_custo_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor vê próprias ajudas de custo"
  ON public.ajuda_custo_vendedor FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR vendedor_user_id = auth.uid()
    OR (factory_id = get_user_factory_id(auth.uid()) AND NOT public.is_vendedor(auth.uid()))
  );

CREATE POLICY "Factory pode gerir ajudas de custo"
  ON public.ajuda_custo_vendedor FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- =========================================================
-- 7. Função: calcular comissão por pacote
-- =========================================================
CREATE OR REPLACE FUNCTION public.calcular_comissao_pacote(_quantidade integer, _recorrente boolean)
RETURNS TABLE (faixa text, valor_base numeric, valor_final numeric)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_faixa text;
  v_valor numeric(10,2);
BEGIN
  IF _quantidade >= 400 THEN
    v_faixa := '400+'; v_valor := 26.00;
  ELSIF _quantidade >= 300 THEN
    v_faixa := '300'; v_valor := 24.00;
  ELSIF _quantidade >= 200 THEN
    v_faixa := '200'; v_valor := 22.50;
  ELSIF _quantidade >= 100 THEN
    v_faixa := '100'; v_valor := 20.00;
  ELSE
    v_faixa := 'sem_comissao'; v_valor := 0;
  END IF;

  RETURN QUERY SELECT
    v_faixa,
    v_valor,
    CASE WHEN _recorrente THEN ROUND(v_valor * 0.5, 2) ELSE v_valor END;
END;
$$;

-- =========================================================
-- 8. Trigger: registra comissão quando venda fica 'paga'
-- =========================================================
-- Detecta status 'pago' tanto na coluna 'status' quanto em 'status_pagamento' se existir
CREATE OR REPLACE FUNCTION public.registrar_comissao_se_paga()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_qtd integer := 0;
  v_recorrente boolean := false;
  v_vendedor record;
  v_calc record;
BEGIN
  -- só age quando o status muda para algo que represente "pago"
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(coalesce(NEW.status::text,'')) IN ('pago','paga','pago_total','quitado','quitada') THEN

    SELECT COALESCE(SUM(quantidade),0) INTO v_total_qtd
    FROM public.venda_itens WHERE venda_id = NEW.id;

    -- Recorrência: cliente já tem qualquer venda anterior à atual
    SELECT EXISTS (
      SELECT 1 FROM public.vendas
      WHERE cliente_id = NEW.cliente_id
        AND id <> NEW.id
        AND created_at < NEW.created_at
    ) INTO v_recorrente;

    SELECT * INTO v_calc FROM public.calcular_comissao_pacote(v_total_qtd, v_recorrente);

    IF v_calc.valor_final > 0 THEN
      FOR v_vendedor IN
        SELECT vendedor_user_id FROM public.cliente_vendedor WHERE cliente_id = NEW.cliente_id
      LOOP
        INSERT INTO public.comissoes_vendas
          (factory_id, venda_id, vendedor_user_id, quantidade_unidades, faixa, valor_base, recorrente, valor_comissao)
        VALUES
          (NEW.factory_id, NEW.id, v_vendedor.vendedor_user_id, v_total_qtd, v_calc.faixa, v_calc.valor_base, v_recorrente, v_calc.valor_final)
        ON CONFLICT (venda_id, vendedor_user_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_comissao ON public.vendas;
CREATE TRIGGER trg_registrar_comissao
  AFTER UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_comissao_se_paga();