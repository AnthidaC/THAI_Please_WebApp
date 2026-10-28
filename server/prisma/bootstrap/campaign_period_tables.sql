-- Bootstrap the two historical tables before the first migration that alters them.
-- Run only in a fresh database after migrations through 20261027130000.
-- The following quota migrations add their own checks and triggers.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.campaign_periods') IS NOT NULL
     OR to_regclass('public.wallet_period_quotas') IS NOT NULL THEN
    RAISE EXCEPTION 'Campaign period bootstrap refuses to replace existing tables';
  END IF;
  IF to_regclass('public.campaigns') IS NULL
     OR to_regclass('public.wallets') IS NULL THEN
    RAISE EXCEPTION 'Campaign and wallet tables must exist before period bootstrap';
  END IF;
END;
$$;

CREATE TABLE public.campaign_periods (
  period_id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  period_name varchar(100) NOT NULL,
  period_quota_limit numeric(12,2) NOT NULL DEFAULT 1000,
  start_date timestamptz(6) NOT NULL,
  end_date timestamptz(6) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaign_periods_pkey PRIMARY KEY (period_id),
  CONSTRAINT fk_campaign_periods_campaign
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX idx_campaign_periods_campaign
  ON public.campaign_periods USING btree (campaign_id);
CREATE INDEX idx_campaign_periods_date_range
  ON public.campaign_periods USING btree (start_date, end_date);

CREATE TABLE public.wallet_period_quotas (
  wallet_period_quota_id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  period_id uuid NOT NULL,
  quota_limit numeric(12,2) NOT NULL,
  quota_used numeric(12,2) NOT NULL DEFAULT 0,
  quota_remaining numeric(12,2) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wallet_period_quotas_pkey PRIMARY KEY (wallet_period_quota_id),
  CONSTRAINT fk_wallet_period_quotas_wallet
    FOREIGN KEY (wallet_id) REFERENCES public.wallets(wallet_id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_wallet_period_quotas_period
    FOREIGN KEY (period_id) REFERENCES public.campaign_periods(period_id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX uq_wallet_period_quotas_wallet_period
  ON public.wallet_period_quotas USING btree (wallet_id, period_id);
CREATE INDEX idx_wallet_period_quotas_period
  ON public.wallet_period_quotas USING btree (period_id);
CREATE INDEX idx_wallet_period_quotas_wallet
  ON public.wallet_period_quotas USING btree (wallet_id);

COMMIT;
