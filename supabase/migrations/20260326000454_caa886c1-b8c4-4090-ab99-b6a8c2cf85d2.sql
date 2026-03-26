
-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid REFERENCES public.factories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  status text NOT NULL DEFAULT 'aberto',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Factory owners see own tickets, super admins see all
CREATE POLICY "Users view own factory tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super admins delete tickets" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- Support messages (chat within tickets)
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket participants can view messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
      AND (t.factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Authenticated can send messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
