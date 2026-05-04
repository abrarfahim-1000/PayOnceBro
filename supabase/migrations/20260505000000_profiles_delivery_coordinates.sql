-- Saved user delivery coordinates on profiles (used by PATCH /api/auth/me/delivery-location)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;

COMMENT ON COLUMN public.profiles.delivery_lat IS 'User saved delivery latitude (WGS84)';
COMMENT ON COLUMN public.profiles.delivery_lng IS 'User saved delivery longitude (WGS84)';
