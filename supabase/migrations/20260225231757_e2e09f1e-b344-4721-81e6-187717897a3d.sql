CREATE POLICY "Admins can delete requests"
ON public.access_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));