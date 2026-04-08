
-- 1. Add created_at to user_roles for deterministic ordering
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Fix get_user_factory_id to be deterministic
CREATE OR REPLACE FUNCTION public.get_user_factory_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT factory_id FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1
$function$;

-- 2. Create factory_secrets table for NF-e keys
CREATE TABLE public.factory_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  nfe_api_key text,
  nfe_company_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id)
);

ALTER TABLE public.factory_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only factory owner or super_admin can read secrets"
  ON public.factory_secrets FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.factories f WHERE f.id = factory_id AND f.owner_id = auth.uid()))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Only factory owner or super_admin can update secrets"
  ON public.factory_secrets FOR UPDATE TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.factories f WHERE f.id = factory_id AND f.owner_id = auth.uid()))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.factories f WHERE f.id = factory_id AND f.owner_id = auth.uid()))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Only factory owner or super_admin can insert secrets"
  ON public.factory_secrets FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.factories f WHERE f.id = factory_id AND f.owner_id = auth.uid()))
    OR is_super_admin(auth.uid())
  );

-- Migrate existing NF-e data to factory_secrets
INSERT INTO public.factory_secrets (factory_id, nfe_api_key, nfe_company_id)
SELECT id, nfe_api_key, nfe_company_id FROM public.factories
WHERE nfe_api_key IS NOT NULL OR nfe_company_id IS NOT NULL
ON CONFLICT (factory_id) DO NOTHING;

-- Remove sensitive columns from factories
ALTER TABLE public.factories DROP COLUMN IF EXISTS nfe_api_key;
ALTER TABLE public.factories DROP COLUMN IF EXISTS nfe_company_id;

-- 3. Fix invites - remove direct UPDATE policy
DROP POLICY IF EXISTS "Users can redeem unused invites" ON public.invites;

-- 4. Restrict pedidos_publicos INSERT
DROP POLICY IF EXISTS "Public can insert orders" ON public.pedidos_publicos;
CREATE POLICY "Public can insert orders with valid factory"
  ON public.pedidos_publicos FOR INSERT TO anon, authenticated
  WITH CHECK (
    factory_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.factories WHERE id = factory_id)
  );

-- 5. Create metas_vendas table
CREATE TABLE public.metas_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  mes date NOT NULL,
  valor_meta numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id, mes)
);

ALTER TABLE public.metas_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage metas_vendas"
  ON public.metas_vendas FOR ALL TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- 6. Create comissoes_config table
CREATE TABLE public.comissoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  vendedor_user_id uuid,
  percentual numeric(5,2) NOT NULL DEFAULT 5.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id, vendedor_user_id)
);

ALTER TABLE public.comissoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage comissoes_config"
  ON public.comissoes_config FOR ALL TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- 7. Add validade column to producoes
ALTER TABLE public.producoes ADD COLUMN IF NOT EXISTS validade date;

-- 8. Create onboarding_progress table
CREATE TABLE public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE UNIQUE,
  sabores_cadastrados boolean NOT NULL DEFAULT false,
  receita_configurada boolean NOT NULL DEFAULT false,
  cliente_cadastrado boolean NOT NULL DEFAULT false,
  primeira_producao boolean NOT NULL DEFAULT false,
  primeira_venda boolean NOT NULL DEFAULT false,
  estoque_configurado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage onboarding_progress"
  ON public.onboarding_progress FOR ALL TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((factory_id = get_user_factory_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Triggers
CREATE TRIGGER update_factory_secrets_updated_at BEFORE UPDATE ON public.factory_secrets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER update_metas_vendas_updated_at BEFORE UPDATE ON public.metas_vendas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER update_comissoes_config_updated_at BEFORE UPDATE ON public.comissoes_config
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
