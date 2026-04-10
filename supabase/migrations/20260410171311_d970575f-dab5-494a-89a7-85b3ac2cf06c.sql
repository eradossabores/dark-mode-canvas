
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'essencial';
