
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  duration_minutes integer NOT NULL DEFAULT 0
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own sessions
CREATE POLICY "Users insert own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions  
CREATE POLICY "Users update own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Super admins can read all sessions
CREATE POLICY "Super admins read all sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Users can read own sessions
CREATE POLICY "Users read own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX idx_user_sessions_factory ON public.user_sessions(factory_id);
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id);
