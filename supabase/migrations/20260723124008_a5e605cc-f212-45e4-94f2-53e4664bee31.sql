
CREATE TABLE public.rotas_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  auxiliar_user_id UUID NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','finalizada','cancelada')),
  observacoes TEXT,
  iniciada_em TIMESTAMPTZ,
  finalizada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rotas_externas_factory ON public.rotas_externas(factory_id, data DESC);
CREATE INDEX idx_rotas_externas_aux ON public.rotas_externas(auxiliar_user_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotas_externas TO authenticated;
GRANT ALL ON public.rotas_externas TO service_role;
ALTER TABLE public.rotas_externas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotas_ext_select" ON public.rotas_externas FOR SELECT TO authenticated USING (auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "rotas_ext_all" ON public.rotas_externas FOR ALL TO authenticated USING ((auxiliar_user_id = auth.uid() AND factory_id = public.get_user_factory_id(auth.uid())) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK ((auxiliar_user_id = auth.uid() AND factory_id = public.get_user_factory_id(auth.uid())) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.rota_paradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES public.rotas_externas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ordem INT NOT NULL DEFAULT 0,
  quantidade_prevista INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','finalizada','cancelada')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rota_paradas_rota ON public.rota_paradas(rota_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_paradas TO authenticated;
GRANT ALL ON public.rota_paradas TO service_role;
ALTER TABLE public.rota_paradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paradas_all" ON public.rota_paradas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.rotas_externas r WHERE r.id = rota_id AND (r.auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.rotas_externas r WHERE r.id = rota_id AND (r.auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'))));

CREATE TABLE public.visitas_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  rota_parada_id UUID REFERENCES public.rota_paradas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  auxiliar_user_id UUID NOT NULL,
  chegada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  saida_em TIMESTAMPTZ,
  quantidade_entregue INT DEFAULT 0,
  foto_antes_url TEXT,
  foto_depois_url TEXT,
  observacao_inicial TEXT,
  observacao_entrega TEXT,
  observacao_organizacao TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','finalizada','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visitas_ext_factory ON public.visitas_externas(factory_id, chegada_em DESC);
CREATE INDEX idx_visitas_ext_aux ON public.visitas_externas(auxiliar_user_id, chegada_em DESC);
CREATE INDEX idx_visitas_ext_cliente ON public.visitas_externas(cliente_id, chegada_em DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_externas TO authenticated;
GRANT ALL ON public.visitas_externas TO service_role;
ALTER TABLE public.visitas_externas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitas_select" ON public.visitas_externas FOR SELECT TO authenticated USING (auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "visitas_insert" ON public.visitas_externas FOR INSERT TO authenticated WITH CHECK (auxiliar_user_id = auth.uid() AND factory_id = public.get_user_factory_id(auth.uid()));
CREATE POLICY "visitas_update" ON public.visitas_externas FOR UPDATE TO authenticated USING (auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "visitas_delete" ON public.visitas_externas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.prospeccoes_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL,
  nome TEXT NOT NULL,
  responsavel TEXT,
  telefone TEXT,
  endereco TEXT,
  tipo TEXT CHECK (tipo IN ('bar','restaurante','conveniencia','mercado','outro')),
  foto_fachada_url TEXT,
  potencial TEXT DEFAULT 'medio' CHECK (potencial IN ('baixo','medio','alto')),
  status TEXT NOT NULL DEFAULT 'novo_contato' CHECK (status IN ('novo_contato','interessado','teste_enviado','cliente_ativo','perdido')),
  observacoes TEXT,
  cliente_convertido_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospex_factory ON public.prospeccoes_externas(factory_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccoes_externas TO authenticated;
GRANT ALL ON public.prospeccoes_externas TO service_role;
ALTER TABLE public.prospeccoes_externas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospex_select" ON public.prospeccoes_externas FOR SELECT TO authenticated USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "prospex_insert" ON public.prospeccoes_externas FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid() AND factory_id = public.get_user_factory_id(auth.uid()));
CREATE POLICY "prospex_update" ON public.prospeccoes_externas FOR UPDATE TO authenticated USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "prospex_delete" ON public.prospeccoes_externas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.ocorrencias_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('falta_produto','produto_danificado','problema_freezer','reclamacao','concorrente','outro')),
  descricao TEXT NOT NULL,
  foto_url TEXT,
  resolvida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ocorr_factory ON public.ocorrencias_externas(factory_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias_externas TO authenticated;
GRANT ALL ON public.ocorrencias_externas TO service_role;
ALTER TABLE public.ocorrencias_externas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocorr_select" ON public.ocorrencias_externas FOR SELECT TO authenticated USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "ocorr_insert" ON public.ocorrencias_externas FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid() AND factory_id = public.get_user_factory_id(auth.uid()));
CREATE POLICY "ocorr_update" ON public.ocorrencias_externas FOR UPDATE TO authenticated USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.pontuacao_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  auxiliar_user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  pontos INT NOT NULL DEFAULT 0,
  referencia_tabela TEXT,
  referencia_id UUID,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pontos_aux ON public.pontuacao_eventos(auxiliar_user_id, created_at DESC);
CREATE INDEX idx_pontos_factory ON public.pontuacao_eventos(factory_id, created_at DESC);
GRANT SELECT, INSERT ON public.pontuacao_eventos TO authenticated;
GRANT ALL ON public.pontuacao_eventos TO service_role;
ALTER TABLE public.pontuacao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pontos_select" ON public.pontuacao_eventos FOR SELECT TO authenticated USING (auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "pontos_insert" ON public.pontuacao_eventos FOR INSERT TO authenticated WITH CHECK (factory_id = public.get_user_factory_id(auth.uid()));

CREATE TABLE public.metas_operacao_externa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  auxiliar_user_id UUID NOT NULL,
  mes DATE NOT NULL,
  meta_clientes_visitados INT DEFAULT 0,
  meta_prospeccoes INT DEFAULT 0,
  meta_novos_clientes INT DEFAULT 0,
  meta_pct_checklist INT DEFAULT 0,
  meta_reducao_ruptura INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (factory_id, auxiliar_user_id, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_operacao_externa TO authenticated;
GRANT ALL ON public.metas_operacao_externa TO service_role;
ALTER TABLE public.metas_operacao_externa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas_select" ON public.metas_operacao_externa FOR SELECT TO authenticated USING (auxiliar_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "metas_admin" ON public.metas_operacao_externa FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'factory_owner') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_upd_rotas_externas BEFORE UPDATE ON public.rotas_externas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER trg_upd_rota_paradas BEFORE UPDATE ON public.rota_paradas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER trg_upd_visitas_externas BEFORE UPDATE ON public.visitas_externas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER trg_upd_prospex BEFORE UPDATE ON public.prospeccoes_externas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER trg_upd_ocorr BEFORE UPDATE ON public.ocorrencias_externas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER trg_upd_metas_op BEFORE UPDATE ON public.metas_operacao_externa FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.pontuar_visita_finalizada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT := 0;
  v_marc INT := 0;
  k TEXT;
  v BOOLEAN;
BEGIN
  IF NEW.status = 'finalizada' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR k, v IN SELECT key, (value)::text::boolean FROM jsonb_each_text(NEW.checklist) LOOP
      v_total := v_total + 1;
      IF v THEN v_marc := v_marc + 1; END IF;
    END LOOP;
    INSERT INTO public.pontuacao_eventos(factory_id, auxiliar_user_id, tipo, pontos, referencia_tabela, referencia_id, descricao)
    VALUES (NEW.factory_id, NEW.auxiliar_user_id, 'cliente_visitado', 5, 'visitas_externas', NEW.id, 'Visita finalizada');
    IF v_total > 0 AND v_marc = v_total THEN
      INSERT INTO public.pontuacao_eventos(factory_id, auxiliar_user_id, tipo, pontos, referencia_tabela, referencia_id, descricao)
      VALUES (NEW.factory_id, NEW.auxiliar_user_id, 'checklist_completo', 5, 'visitas_externas', NEW.id, 'Checklist 100%');
    END IF;
    IF NEW.foto_antes_url IS NOT NULL AND NEW.foto_depois_url IS NOT NULL THEN
      INSERT INTO public.pontuacao_eventos(factory_id, auxiliar_user_id, tipo, pontos, referencia_tabela, referencia_id, descricao)
      VALUES (NEW.factory_id, NEW.auxiliar_user_id, 'freezer_organizado', 5, 'visitas_externas', NEW.id, 'Freezer abastecido');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pontuar_visita AFTER UPDATE ON public.visitas_externas FOR EACH ROW EXECUTE FUNCTION public.pontuar_visita_finalizada();

CREATE OR REPLACE FUNCTION public.pontuar_prospeccao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pontuacao_eventos(factory_id, auxiliar_user_id, tipo, pontos, referencia_tabela, referencia_id, descricao)
    VALUES (NEW.factory_id, NEW.criado_por, 'prospeccao_nova', 20, 'prospeccoes_externas', NEW.id, 'Novo ponto: ' || NEW.nome);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cliente_ativo' AND OLD.status IS DISTINCT FROM 'cliente_ativo' THEN
    INSERT INTO public.pontuacao_eventos(factory_id, auxiliar_user_id, tipo, pontos, referencia_tabela, referencia_id, descricao)
    VALUES (NEW.factory_id, NEW.criado_por, 'cliente_convertido', 50, 'prospeccoes_externas', NEW.id, 'Convertido: ' || NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pontuar_prospex AFTER INSERT OR UPDATE ON public.prospeccoes_externas FOR EACH ROW EXECUTE FUNCTION public.pontuar_prospeccao();

CREATE POLICY "op_ext_fotos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'operacao-externa');
CREATE POLICY "op_ext_fotos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operacao-externa');
CREATE POLICY "op_ext_fotos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'operacao-externa');
CREATE POLICY "op_ext_fotos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'operacao-externa');
