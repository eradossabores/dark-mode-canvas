
-- Create storage bucket for factory logos
INSERT INTO storage.buckets (id, name, public) VALUES ('factory-logos', 'factory-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone authenticated to upload to factory-logos
CREATE POLICY "Authenticated users can upload factory logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'factory-logos');

-- Allow public read access to factory logos
CREATE POLICY "Public can view factory logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'factory-logos');

-- Allow authenticated users to update/delete their uploads
CREATE POLICY "Authenticated users can manage factory logos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'factory-logos')
WITH CHECK (bucket_id = 'factory-logos');
