
-- Drop existing restrictive policies on access_requests
DROP POLICY IF EXISTS "Admins can update requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.access_requests;
DROP POLICY IF EXISTS "Users can insert own request" ON public.access_requests;
DROP POLICY IF EXISTS "Users can view own request" ON public.access_requests;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own request"
  ON public.access_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own request"
  ON public.access_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
  ON public.access_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update requests"
  ON public.access_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
