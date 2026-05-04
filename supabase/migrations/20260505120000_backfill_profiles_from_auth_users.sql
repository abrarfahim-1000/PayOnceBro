-- Backfill profiles for auth users missing a row (pre-trigger accounts, imports, failed triggers).

INSERT INTO public.profiles (id, role, username, full_name, email)
SELECT
  au.id,
  COALESCE(NULLIF(trim(COALESCE(au.raw_user_meta_data->>'role', '')), ''), 'user'),
  NULLIF(trim(COALESCE(au.raw_user_meta_data->>'username', '')), ''),
  COALESCE(
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'full_name', '')), ''),
    trim(au.email::text),
    'User'
  ),
  au.email
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);
