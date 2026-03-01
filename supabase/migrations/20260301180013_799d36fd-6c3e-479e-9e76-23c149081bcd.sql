
-- Add imagem_url column to sabores table
ALTER TABLE public.sabores ADD COLUMN IF NOT EXISTS imagem_url text;

-- Create storage bucket for sabor images
INSERT INTO storage.buckets (id, name, public)
VALUES ('sabor-images', 'sabor-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view images (public bucket)
CREATE POLICY "Public read access for sabor images"
ON storage.objects FOR SELECT
USING (bucket_id = 'sabor-images');

-- Allow authenticated users to upload/update/delete images
CREATE POLICY "Authenticated users can upload sabor images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sabor-images');

CREATE POLICY "Authenticated users can update sabor images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sabor-images');

CREATE POLICY "Authenticated users can delete sabor images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sabor-images');
