DO $$
DECLARE
  v_user_id uuid;
  v_factory_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'yuri.vendedor@aeradossabores.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      'yuri.vendedor@aeradossabores.com',
      crypt('Yuri@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Yuri"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'yuri.vendedor@aeradossabores.com'),
      'email', v_user_id::text, now(), now(), now());
  END IF;

  -- Profile
  INSERT INTO public.profiles (id, email, nome, factory_id)
  VALUES (v_user_id, 'yuri.vendedor@aeradossabores.com', 'Yuri', v_factory_id)
  ON CONFLICT (id) DO UPDATE SET factory_id = EXCLUDED.factory_id, nome = EXCLUDED.nome;

  -- Role vendedor
  INSERT INTO public.user_roles (user_id, role, factory_id)
  VALUES (v_user_id, 'vendedor', v_factory_id)
  ON CONFLICT DO NOTHING;
END $$;