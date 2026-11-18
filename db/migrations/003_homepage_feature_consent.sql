-- Homepage featuring is opt-in and only applies after the owner has reviewed which products are public.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS feature_on_homepage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS showcase_reviewed_at timestamptz;
