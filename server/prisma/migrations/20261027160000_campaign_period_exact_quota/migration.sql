BEGIN;

DO $$
DECLARE
  mismatched_campaigns text;
BEGIN
  IF to_regclass('public.campaign_periods') IS NULL THEN
    RAISE EXCEPTION 'Campaign period table is missing; refusing to enforce exact quota totals';
  END IF;

  IF to_regprocedure('public.lock_campaign_period_parent()') IS NULL
     OR to_regprocedure('public.assert_campaign_period_integrity(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected campaign period integrity functions are missing';
  END IF;

  SELECT string_agg(c.campaign_id::text, ', ' ORDER BY c.campaign_id::text)
    INTO mismatched_campaigns
    FROM public.campaigns c
    JOIN (
      SELECT campaign_id, sum(period_quota_limit) AS configured_quota
      FROM public.campaign_periods
      GROUP BY campaign_id
    ) period_totals USING (campaign_id)
   WHERE period_totals.configured_quota <> c.total_quota_limit;

  IF mismatched_campaigns IS NOT NULL THEN
    RAISE EXCEPTION 'Existing campaign period quotas do not equal their campaign totals. Reconcile these campaign IDs explicitly before applying this migration: %', mismatched_campaigns;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_campaign_period_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1
      FROM public.campaigns
     WHERE campaign_id = OLD.campaign_id
     FOR UPDATE;
    RETURN OLD;
  END IF;

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

DROP TRIGGER trg_campaign_period_parent_lock ON public.campaign_periods;
CREATE TRIGGER trg_campaign_period_parent_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_periods
FOR EACH ROW EXECUTE FUNCTION public.lock_campaign_period_parent();

CREATE OR REPLACE FUNCTION public.assert_campaign_period_integrity(target_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  campaign_start timestamptz;
  campaign_end timestamptz;
  campaign_quota numeric;
  has_periods boolean;
  configured_quota numeric;
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

  SELECT EXISTS (
    SELECT 1 FROM public.campaign_periods WHERE campaign_id = target_campaign_id
  ), COALESCE((
    SELECT sum(period_quota_limit)
    FROM public.campaign_periods
    WHERE campaign_id = target_campaign_id
  ), 0)
    INTO has_periods, configured_quota;

  IF has_periods AND configured_quota <> campaign_quota THEN
    RAISE EXCEPTION 'The sum of campaign period quotas must equal the campaign quota';
  END IF;
END;
$$;

COMMIT;
