-- Fix: Restrict user_roles INSERT to super_admin only (prevent privilege escalation)
-- First, drop any existing INSERT-permissive policies on user_roles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'user_roles' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END$$;

-- Create restrictive INSERT policy: only super_admin can insert roles
CREATE POLICY "Only super_admin can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- Also restrict UPDATE to super_admin only
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'user_roles' AND schemaname = 'public' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "Only super_admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Restrict DELETE to super_admin only
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'user_roles' AND schemaname = 'public' AND cmd = 'DELETE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "Only super_admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Fix storage policies: scope by factory path
-- sabor-images bucket
DROP POLICY IF EXISTS "Factory users upload sabor images" ON storage.objects;
DROP POLICY IF EXISTS "Factory users update sabor images" ON storage.objects;
DROP POLICY IF EXISTS "Factory users delete sabor images" ON storage.objects;

CREATE POLICY "Factory users upload sabor images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sabor-images' 
  AND (storage.foldername(name))[1] = (public.get_user_factory_id(auth.uid()))::text
);

CREATE POLICY "Factory users update sabor images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'sabor-images' 
  AND (storage.foldername(name))[1] = (public.get_user_factory_id(auth.uid()))::text
);

CREATE POLICY "Factory users delete sabor images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sabor-images' 
  AND (storage.foldername(name))[1] = (public.get_user_factory_id(auth.uid()))::text
);

-- factory-logos bucket
DROP POLICY IF EXISTS "Factory users upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Factory users update logos" ON storage.objects;
DROP POLICY IF EXISTS "Factory users delete logos" ON storage.objects;

CREATE POLICY "Factory users upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'factory-logos' 
  AND (storage.foldername(name))[1] = (public.get_user_factory_id(auth.uid()))::text
);

CREATE POLICY "Factory users update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'factory-logos' 
  AND (storage.foldername(name))[1] = (public.get_user_factory_id(auth.uid()))::text
);

CREATE POLICY "Factory users delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'factory-logos' 
  AND (storage.foldername(name))[1] = (public.get_user_factory_id(auth.uid()))::text
);