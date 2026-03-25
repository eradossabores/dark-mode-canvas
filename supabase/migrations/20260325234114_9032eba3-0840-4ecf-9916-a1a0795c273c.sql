
-- Step 1: Add new roles to enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'factory_owner';

-- Step 2: Create factories table
CREATE TABLE IF NOT EXISTS public.factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  theme jsonb DEFAULT '{}'::jsonb,
  owner_id uuid NOT NULL,
  max_collaborators integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;

-- Step 3: Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'trial',
  trial_start timestamptz DEFAULT now(),
  current_period_start date,
  current_period_end date,
  grace_until date,
  amount numeric DEFAULT 99.90,
  paid_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Step 4: Add factory_id to all existing data tables
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.sabores ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.producoes ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.estoque_gelos ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.materias_primas ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.embalagens ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.pedidos_producao ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.avarias ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.prospectos ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.decisoes_producao ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.presenca_producao ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.pedidos_publicos ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.sabor_receita ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.contato_landing ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.venda_itens ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.venda_parcelas ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.producao_funcionarios ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.pedido_producao_itens ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.cliente_preco_sabor ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.cliente_tabela_preco ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.estoque_freezer ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.abatimentos_historico ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.followup_mensagens ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.prospecto_visitas ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);

-- Add factory_id to user_roles and profiles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS factory_id uuid REFERENCES public.factories(id);

-- Triggers
CREATE TRIGGER set_updated_at_factories
  BEFORE UPDATE ON public.factories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
