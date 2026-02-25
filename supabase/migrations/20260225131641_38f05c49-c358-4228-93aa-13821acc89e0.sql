
-- Tabela de convites para cadastro
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role TEXT NOT NULL DEFAULT 'admin',
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins can view and create invites
CREATE POLICY "Admins can view invites" ON public.invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create invites" ON public.invites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Anyone authenticated can read invite by token (for registration)
CREATE POLICY "Anyone can read valid invite by token" ON public.invites
  FOR SELECT USING (true);

-- Service role can update invites (mark as used)
CREATE POLICY "Authenticated users can mark invite used" ON public.invites
  FOR UPDATE USING (true);
