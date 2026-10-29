BEGIN;

DO $$
DECLARE
  unmatched_quest_types text[];
BEGIN
  IF to_regclass('public.badge_condition_types') IS NULL THEN
    RAISE EXCEPTION 'public.badge_condition_types is missing; refusing to rename the condition catalog';
  END IF;

  IF to_regclass('public.condition_types') IS NOT NULL THEN
    RAISE EXCEPTION 'public.condition_types already exists; refusing to overwrite it';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quests' AND column_name = 'quest_type'
  ) THEN
    RAISE EXCEPTION 'public.quests.quest_type is missing; refusing to rename it';
  END IF;

  SELECT array_agg(DISTINCT quest.quest_type ORDER BY quest.quest_type)
  INTO unmatched_quest_types
  FROM public.quests AS quest
  WHERE NOT EXISTS (
    SELECT 1 FROM public.badge_condition_types AS condition_type
    WHERE condition_type.condition_key = quest.quest_type
  );

  IF unmatched_quest_types IS NOT NULL THEN
    RAISE EXCEPTION 'Quest types must exist in the condition catalog before adding the foreign key: %', unmatched_quest_types;
  END IF;
END;
$$;

ALTER TABLE public.badge_condition_types RENAME TO condition_types;
ALTER TABLE public.condition_types RENAME CONSTRAINT achievement_condition_types_pkey TO condition_types_pkey;
ALTER TABLE public.condition_types RENAME CONSTRAINT uq_achievement_condition_types_key TO uq_condition_types_key;
ALTER TABLE public.condition_types RENAME CONSTRAINT chk_achievement_condition_types_unit TO chk_condition_types_unit;
ALTER TABLE public.condition_types RENAME CONSTRAINT chk_achievement_condition_types_status TO chk_condition_types_status;
ALTER INDEX public.idx_achievement_condition_types_status RENAME TO idx_condition_types_status;
ALTER FUNCTION public.prevent_achievement_condition_key_change() RENAME TO prevent_condition_key_change;
ALTER TRIGGER trg_achievement_condition_key_immutable ON public.condition_types RENAME TO trg_condition_key_immutable;

ALTER TABLE public.quests RENAME COLUMN quest_type TO condition_type;
ALTER TABLE public.quests
  ADD CONSTRAINT fk_quests_condition_type
  FOREIGN KEY (condition_type)
  REFERENCES public.condition_types (condition_key)
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;

CREATE INDEX idx_quests_condition_type ON public.quests (condition_type);

COMMIT;
