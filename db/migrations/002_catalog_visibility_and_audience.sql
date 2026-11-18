-- Owner-controlled catalog visibility and per-platform audience counts.
-- Additive only: new columns default to the previous behaviour (everything public),
-- and a new table. Safe to apply before deploying the code that reads them.

ALTER TABLE public.stripe_products
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.stripe_plans
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.payment_provider_catalog_items
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.profile_audience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  platform varchar(24) NOT NULL,
  followers bigint NOT NULL,
  -- 'verified' = read from the platform's public API by epic.li; 'self_reported' = typed by the owner.
  source text NOT NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_audience_followers_check CHECK (followers >= 0 AND followers <= 10000000000),
  CONSTRAINT profile_audience_source_check CHECK (source IN ('verified', 'self_reported'))
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_audience_profile_platform_unique
  ON public.profile_audience (profile_id, platform);
