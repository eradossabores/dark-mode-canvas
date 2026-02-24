
-- Create access_requests table for Google OAuth users pending approval
CREATE TABLE public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  role_solicitado TEXT NOT NULL DEFAULT 'producao',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own request
CREATE POLICY "Users can view own request"
  ON public.access_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON public.access_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
  ON public.access_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own request
CREATE POLICY "Users can insert own request"
  ON public.access_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to auto-create access request for new Google signups
CREATE OR REPLACE FUNCTION public.handle_new_google_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
      INSERT INTO public.access_requests (user_id, email, nome)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', NEW.email)
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    INSERT INTO public.profiles (id, email, nome)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      nome = COALESCE(EXCLUDED.nome, profiles.nome);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users for new signups
CREATE TRIGGER on_google_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_google_signup();
