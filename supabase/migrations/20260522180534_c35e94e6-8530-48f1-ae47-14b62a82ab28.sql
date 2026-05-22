-- Create the bucket for purchase invoices if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('compras_anexos', 'compras_anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'compras_anexos');

-- Policy for authenticated users to upload files
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'compras_anexos');

-- Policy for authenticated users to update their files
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'compras_anexos');

-- Policy for authenticated users to delete their files
CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'compras_anexos');