BEGIN;

DO $$
BEGIN
  IF to_regclass('public.badges') IS NULL THEN
    RAISE EXCEPTION 'Badge table is missing; refusing to create condition type definitions';
  END IF;

  IF to_regclass('public.achievement_condition_types') IS NOT NULL THEN
    RAISE EXCEPTION 'Condition type table already exists outside this migration';
  END IF;

  IF to_regclass('public.achievement_condition_types_pkey') IS NOT NULL
     OR to_regclass('public.uq_achievement_condition_types_key') IS NOT NULL
     OR to_regclass('public.idx_achievement_condition_types_status') IS NOT NULL
     OR to_regprocedure('public.prevent_achievement_condition_key_change()') IS NOT NULL THEN
    RAISE EXCEPTION 'Condition type index or trigger function already exists outside this migration';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_achievement_condition_key_immutable' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Condition type immutability trigger already exists outside this migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_badges_condition_type'
      AND conrelid = 'public.badges'::regclass
  ) THEN
    RAISE EXCEPTION 'Badge condition type foreign key already exists outside this migration';
  END IF;
END;
$$;

CREATE TABLE public.achievement_condition_types (
  condition_type_id uuid NOT NULL DEFAULT gen_random_uuid(),
  condition_key varchar(50) NOT NULL,
  display_name varchar(100) NOT NULL,
  description text,
  measurement_unit varchar(20) NOT NULL DEFAULT 'other',
  implementation_status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT achievement_condition_types_pkey PRIMARY KEY (condition_type_id),
  CONSTRAINT uq_achievement_condition_types_key UNIQUE (condition_key),
  CONSTRAINT chk_achievement_condition_types_unit CHECK (measurement_unit IN ('count', 'amount', 'other')),
  CONSTRAINT chk_achievement_condition_types_status CHECK (implementation_status IN ('pending', 'in_progress', 'ready'))
);

CREATE INDEX idx_achievement_condition_types_status
  ON public.achievement_condition_types (implementation_status);

INSERT INTO public.achievement_condition_types (
  condition_key, display_name, description, measurement_unit, implementation_status
) VALUES
  ('transaction_count', 'จำนวนรายการที่สำเร็จ', 'นับรายการใช้จ่ายที่ผ่านเกณฑ์ของโครงการ', 'count', 'ready'),
  ('referral_count', 'จำนวนผู้ใช้ที่แนะนำ', 'นับผู้ใช้ที่สมัครและทำรายการตามเงื่อนไขการแนะนำเพื่อน', 'count', 'ready'),
  ('review_count', 'จำนวนรีวิวจากการซื้อ', 'นับรีวิวจากรายการซื้อที่ผ่านการตรวจสอบแล้ว', 'count', 'ready'),
  ('total_spending', 'ยอดใช้จ่ายสะสม', 'รวมยอดใช้จ่ายของรายการที่ผ่านเกณฑ์', 'amount', 'ready');

INSERT INTO public.achievement_condition_types (
  condition_key, display_name, description, measurement_unit, implementation_status
)
SELECT DISTINCT
  b.condition_type,
  b.condition_type,
  'ประเภทเงื่อนไขเดิมที่รอการพัฒนาตัวประมวลผลโดยทีม Backend',
  'other',
  'pending'
FROM public.badges b
ON CONFLICT (condition_key) DO NOTHING;

ALTER TABLE public.badges
  ADD CONSTRAINT fk_badges_condition_type
  FOREIGN KEY (condition_type)
  REFERENCES public.achievement_condition_types (condition_key)
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;

CREATE FUNCTION public.prevent_achievement_condition_key_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.condition_key IS DISTINCT FROM OLD.condition_key THEN
    RAISE EXCEPTION 'Condition keys are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_condition_key_immutable
BEFORE UPDATE OF condition_key ON public.achievement_condition_types
FOR EACH ROW EXECUTE FUNCTION public.prevent_achievement_condition_key_change();

COMMIT;
