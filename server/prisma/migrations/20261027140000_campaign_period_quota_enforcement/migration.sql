BEGIN;

DO $$
BEGIN
  IF to_regclass('public.campaign_periods') IS NULL
     OR to_regclass('public.wallet_period_quotas') IS NULL THEN
    RAISE EXCEPTION 'Campaign period tables must already exist before this migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_periods p
    JOIN public.campaigns c USING (campaign_id)
    WHERE p.start_date >= p.end_date
       OR p.period_quota_limit < 0
       OR p.start_date < c.start_date
       OR p.end_date > c.end_date
  ) THEN
    RAISE EXCEPTION 'Existing campaign periods violate date or quota rules';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_periods a
    JOIN public.campaign_periods b
      ON a.campaign_id = b.campaign_id
     AND a.period_id < b.period_id
     AND a.start_date < b.end_date
     AND b.start_date < a.end_date
  ) THEN
    RAISE EXCEPTION 'Existing campaign periods overlap';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT campaign_id, sum(period_quota_limit) AS configured_quota
      FROM public.campaign_periods
      GROUP BY campaign_id
    ) period_totals
    JOIN public.campaigns c USING (campaign_id)
    WHERE period_totals.configured_quota > c.total_quota_limit
  ) THEN
    RAISE EXCEPTION 'Existing period quotas exceed a campaign quota';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wallet_period_quotas
    WHERE quota_limit < 0
       OR quota_used < 0
       OR quota_remaining < 0
       OR quota_used > quota_limit
       OR quota_remaining <> quota_limit - quota_used
  ) THEN
    RAISE EXCEPTION 'Existing wallet period allocations violate quota rules';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT wallet_id, period_id
      FROM public.wallet_period_quotas
      GROUP BY wallet_id, period_id
      HAVING count(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Duplicate wallet period allocations exist';
  END IF;
END;
$$;

ALTER TABLE public.campaign_periods
  ADD CONSTRAINT chk_campaign_period_range CHECK (start_date < end_date) NOT VALID,
  ADD CONSTRAINT chk_campaign_period_quota_nonnegative CHECK (period_quota_limit >= 0) NOT VALID;

ALTER TABLE public.wallet_period_quotas
  ADD CONSTRAINT chk_wallet_period_quota_values CHECK (
    quota_limit >= 0
    AND quota_used >= 0
    AND quota_remaining >= 0
    AND quota_used <= quota_limit
    AND quota_remaining = quota_limit - quota_used
  ) NOT VALID;

ALTER TABLE public.campaign_periods
  VALIDATE CONSTRAINT chk_campaign_period_range,
  VALIDATE CONSTRAINT chk_campaign_period_quota_nonnegative;

ALTER TABLE public.wallet_period_quotas
  VALIDATE CONSTRAINT chk_wallet_period_quota_values;

CREATE FUNCTION public.lock_campaign_period_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.campaign_id IS DISTINCT FROM OLD.campaign_id THEN
    RAISE EXCEPTION 'A period cannot be moved to a different campaign';
  END IF;

  PERFORM 1 FROM public.campaigns WHERE campaign_id = NEW.campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign for period does not exist';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_campaign_period_parent_lock
BEFORE INSERT OR UPDATE ON public.campaign_periods
FOR EACH ROW EXECUTE FUNCTION public.lock_campaign_period_parent();

CREATE FUNCTION public.assert_campaign_period_integrity(target_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  campaign_start timestamptz;
  campaign_end timestamptz;
  campaign_quota numeric;
BEGIN
  SELECT start_date, end_date, total_quota_limit
    INTO campaign_start, campaign_end, campaign_quota
    FROM public.campaigns
   WHERE campaign_id = target_campaign_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_periods p
    WHERE p.campaign_id = target_campaign_id
      AND (p.start_date < campaign_start OR p.end_date > campaign_end OR p.start_date >= p.end_date)
  ) THEN
    RAISE EXCEPTION 'Campaign periods must be valid and remain within campaign dates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_periods a
    JOIN public.campaign_periods b
      ON a.campaign_id = b.campaign_id
     AND a.period_id < b.period_id
     AND a.start_date < b.end_date
     AND b.start_date < a.end_date
    WHERE a.campaign_id = target_campaign_id
  ) THEN
    RAISE EXCEPTION 'Campaign periods cannot overlap';
  END IF;

  IF COALESCE((SELECT sum(period_quota_limit) FROM public.campaign_periods WHERE campaign_id = target_campaign_id), 0) > campaign_quota THEN
    RAISE EXCEPTION 'Configured period quotas cannot exceed the campaign quota';
  END IF;
END;
$$;

CREATE FUNCTION public.validate_campaign_period_integrity_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_campaign_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'campaigns' THEN
    target_campaign_id := NEW.campaign_id;
  ELSIF TG_OP = 'DELETE' THEN
    target_campaign_id := OLD.campaign_id;
  ELSE
    target_campaign_id := NEW.campaign_id;
  END IF;

  PERFORM public.assert_campaign_period_integrity(target_campaign_id);
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_campaign_period_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_periods
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_period_integrity_trigger();

CREATE CONSTRAINT TRIGGER trg_campaign_period_campaign_integrity
AFTER UPDATE ON public.campaigns
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_period_integrity_trigger();

COMMIT;
