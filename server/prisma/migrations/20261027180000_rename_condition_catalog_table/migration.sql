DO $$
DECLARE
  old_table_exists BOOLEAN := to_regclass('public.achievement_condition_types') IS NOT NULL;
  new_table_exists BOOLEAN := to_regclass('public.badge_condition_types') IS NOT NULL;
BEGIN
  IF old_table_exists AND new_table_exists THEN
    RAISE EXCEPTION 'Both condition catalog tables exist; resolve the duplicate before applying this migration.';
  ELSIF old_table_exists THEN
    ALTER TABLE public.achievement_condition_types RENAME TO badge_condition_types;
  ELSIF NOT new_table_exists THEN
    RAISE EXCEPTION 'Neither condition catalog table exists; apply the condition catalog migration first.';
  END IF;
END $$;
