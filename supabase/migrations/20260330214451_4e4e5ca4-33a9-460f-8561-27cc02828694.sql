
-- Tabela de fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  factory_id uuid REFERENCES public.factories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage fornecedores"
  ON public.fornecedores FOR ALL TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Tabela de compras
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'insumo', -- 'insumo' or 'embalagem'
  item_id uuid, -- referencia a materias_primas ou embalagens
  item_nome text NOT NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  tem_frete boolean NOT NULL DEFAULT false,
  valor_frete numeric NOT NULL DEFAULT 0,
  custo_total_com_frete numeric NOT NULL DEFAULT 0,
  custo_unitario_com_frete numeric NOT NULL DEFAULT 0,
  observacoes text,
  factory_id uuid REFERENCES public.factories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage compras"
  ON public.compras FOR ALL TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER set_updated_at_fornecedores BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_compras BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
