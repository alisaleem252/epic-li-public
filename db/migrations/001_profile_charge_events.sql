-- Minimal, dated charge facts for public Revenue/MRR/Churn trajectories.
-- customer_hash is a one-way HMAC; no customer identifiers are stored.
CREATE TABLE IF NOT EXISTS public.profile_charge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  charge_id varchar(128) NOT NULL,
  occurred_at timestamptz NOT NULL,
  currency varchar(3) NOT NULL,
  amount_captured_minor bigint NOT NULL DEFAULT 0,
  is_recurring boolean NOT NULL DEFAULT false,
  customer_hash varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_charge_events_amount_check CHECK (amount_captured_minor >= 0),
  CONSTRAINT profile_charge_events_currency_check CHECK (currency ~ '^[a-z]{3}$'),
  CONSTRAINT profile_charge_events_customer_hash_check CHECK (customer_hash is null or length(customer_hash) = 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_charge_events_profile_charge_unique
  ON public.profile_charge_events (profile_id, charge_id);

CREATE INDEX IF NOT EXISTS profile_charge_events_profile_occurred_idx
  ON public.profile_charge_events (profile_id, occurred_at);
