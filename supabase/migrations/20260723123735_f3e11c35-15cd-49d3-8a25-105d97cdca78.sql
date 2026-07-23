ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auxiliar_externo';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;