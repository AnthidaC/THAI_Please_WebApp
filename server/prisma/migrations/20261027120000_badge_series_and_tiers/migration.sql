BEGIN;

-- Fail before touching the legacy tables when their tier definitions cannot be
-- represented without choosing or discarding a value.
DO $migration$
DECLARE
  conflicting_condition text;
BEGIN
  IF EXISTS (SELECT 1 FROM badges WHERE required_count <= 0) THEN
    RAISE EXCEPTION 'Badge migration stopped: legacy required_count values must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM badges
    WHERE badge_level NOT IN ('Bronze', 'Silver', 'Gold', 'Rainbow')
  ) THEN
    RAISE EXCEPTION 'Badge migration stopped: a legacy badge_level is not Bronze, Silver, Gold, or Rainbow';
  END IF;

  SELECT condition_type INTO conflicting_condition
  FROM badges
  GROUP BY condition_type
  HAVING COUNT(DISTINCT badge_name) > 1
      OR COUNT(DISTINCT description) + CASE WHEN COUNT(description) < COUNT(*) THEN 1 ELSE 0 END > 1
  LIMIT 1;
  IF conflicting_condition IS NOT NULL THEN
    RAISE EXCEPTION 'Badge migration stopped: condition_type % has inconsistent legacy badge names or descriptions', conflicting_condition;
  END IF;

  SELECT condition_type INTO conflicting_condition
  FROM badges
  GROUP BY condition_type, badge_level
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF conflicting_condition IS NOT NULL THEN
    RAISE EXCEPTION 'Badge migration stopped: condition_type % has duplicate legacy tier levels', conflicting_condition;
  END IF;

  SELECT condition_type INTO conflicting_condition
  FROM badges
  GROUP BY condition_type, required_count
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF conflicting_condition IS NOT NULL THEN
    RAISE EXCEPTION 'Badge migration stopped: condition_type % has duplicate legacy tier thresholds', conflicting_condition;
  END IF;

  SELECT condition_type INTO conflicting_condition
  FROM (
    SELECT condition_type,
           required_count,
           LAG(required_count) OVER (
             PARTITION BY condition_type
             ORDER BY CASE badge_level
               WHEN 'Bronze' THEN 1 WHEN 'Silver' THEN 2
               WHEN 'Gold' THEN 3 WHEN 'Rainbow' THEN 4
             END
           ) AS previous_count
    FROM badges
  ) ordered_tiers
  WHERE previous_count IS NOT NULL AND required_count <= previous_count
  LIMIT 1;
  IF conflicting_condition IS NOT NULL THEN
    RAISE EXCEPTION 'Badge migration stopped: condition_type % has thresholds that do not strictly increase by tier', conflicting_condition;
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_badges
    GROUP BY user_id, badge_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Badge migration stopped: duplicate legacy user_badges rows exist for the same user and badge';
  END IF;
END;
$migration$;

-- Preserve the original tables and all their IDs for audit and rollback review.
ALTER TABLE badges RENAME TO badges_legacy;
ALTER TABLE user_badges RENAME TO user_badges_legacy;
-- Renaming a table does not rename its primary-key constraint or backing index.
-- Free the names used by the replacement tables while preserving legacy keys.
ALTER TABLE badges_legacy RENAME CONSTRAINT badges_pkey TO badges_legacy_pkey;
ALTER TABLE user_badges_legacy RENAME CONSTRAINT user_badges_pkey TO user_badges_legacy_pkey;
ALTER INDEX uq_badges_level_condition RENAME TO uq_badges_legacy_level_condition;
ALTER INDEX idx_user_badges_badge RENAME TO idx_user_badges_legacy_badge;
ALTER INDEX idx_user_badges_user RENAME TO idx_user_badges_legacy_user;
ALTER INDEX uq_user_badges_user_badge RENAME TO uq_user_badges_legacy_user_badge;
ALTER TABLE user_badges_legacy RENAME CONSTRAINT fk_user_badges_badge TO fk_user_badges_legacy_badge;
ALTER TABLE user_badges_legacy RENAME CONSTRAINT fk_user_badges_user TO fk_user_badges_legacy_user;
ALTER TABLE user_badges_legacy DROP CONSTRAINT fk_user_badges_legacy_badge;
ALTER TABLE user_badges_legacy ADD CONSTRAINT fk_user_badges_legacy_badge
  FOREIGN KEY (badge_id) REFERENCES badges_legacy(badge_id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE badges (
  badge_id UUID NOT NULL DEFAULT gen_random_uuid(),
  badge_name VARCHAR(100) NOT NULL,
  description TEXT,
  condition_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  implementation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT badges_pkey PRIMARY KEY (badge_id),
  CONSTRAINT uq_badges_condition_type UNIQUE (condition_type),
  CONSTRAINT chk_badges_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_badges_implementation_status CHECK (implementation_status IN ('pending', 'in_progress', 'ready'))
);

CREATE INDEX idx_badges_status_implementation ON badges(status, implementation_status);

CREATE TABLE badge_tiers (
  tier_id UUID NOT NULL DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL,
  tier_name VARCHAR(50) NOT NULL,
  tier_level INTEGER NOT NULL,
  required_count INTEGER NOT NULL,
  icon_url VARCHAR(2048),
  CONSTRAINT badge_tiers_pkey PRIMARY KEY (tier_id),
  CONSTRAINT uq_badge_tiers_badge_level UNIQUE (badge_id, tier_level) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_badge_tiers_badge_required_count UNIQUE (badge_id, required_count) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_badge_tiers_badge_tier UNIQUE (badge_id, tier_id),
  CONSTRAINT chk_badge_tiers_tier_level_positive CHECK (tier_level > 0),
  CONSTRAINT chk_badge_tiers_required_count_positive CHECK (required_count > 0),
  CONSTRAINT fk_badge_tiers_badge FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX idx_badge_tiers_badge ON badge_tiers(badge_id);

CREATE TABLE user_badges (
  user_badge_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL,
  badge_tier_id UUID NOT NULL,
  earned_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_badges_pkey PRIMARY KEY (user_badge_id),
  CONSTRAINT uq_user_badges_user_badge_current UNIQUE (user_id, badge_id),
  CONSTRAINT fk_user_badges_badge FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_user_badges_badge_tier FOREIGN KEY (badge_id, badge_tier_id) REFERENCES badge_tiers(badge_id, tier_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

CREATE TABLE user_badge_history (
  history_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL,
  badge_tier_id UUID NOT NULL,
  earned_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_user_badge_id UUID,
  CONSTRAINT user_badge_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT uq_user_badge_history_legacy_id UNIQUE (legacy_user_badge_id),
  CONSTRAINT uq_user_badge_history_user_tier UNIQUE (user_id, badge_tier_id),
  CONSTRAINT fk_user_badge_history_badge FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_user_badge_history_badge_tier FOREIGN KEY (badge_id, badge_tier_id) REFERENCES badge_tiers(badge_id, tier_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_user_badge_history_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX idx_user_badge_history_badge_earned ON user_badge_history(badge_id, earned_at);
CREATE INDEX idx_user_badge_history_user_earned ON user_badge_history(user_id, earned_at);

-- Duplicate condition_type values in the old table represented distinct tiers.
-- They become one series, with every legacy row retained as a tier.
CREATE TEMPORARY TABLE _badge_series_map ON COMMIT DROP AS
SELECT condition_type, gen_random_uuid() AS badge_id
FROM (SELECT DISTINCT condition_type FROM badges_legacy) conditions;

INSERT INTO badges (badge_id, badge_name, description, condition_type, status, implementation_status, created_at, updated_at)
SELECT series.badge_id,
       legacy.badge_name,
       legacy.description,
       series.condition_type,
       'inactive',
       'pending',
       legacy.created_at,
       legacy.created_at
FROM _badge_series_map series
JOIN LATERAL (
  SELECT badge_name, description, MIN(created_at) AS created_at
  FROM badges_legacy
  WHERE condition_type = series.condition_type
  GROUP BY badge_name, description
  ORDER BY MIN(created_at), badge_name
  LIMIT 1
) legacy ON TRUE;

INSERT INTO badge_tiers (tier_id, badge_id, tier_name, tier_level, required_count, icon_url)
SELECT legacy.badge_id,
       series.badge_id,
       legacy.badge_level,
       CASE legacy.badge_level
         WHEN 'Bronze' THEN 1 WHEN 'Silver' THEN 2
         WHEN 'Gold' THEN 3 WHEN 'Rainbow' THEN 4
       END,
       legacy.required_count,
       NULL
FROM badges_legacy legacy
JOIN _badge_series_map series USING (condition_type);

-- Keep each former unlock timestamp and ID, including all lower tiers earned
-- before a user reached their current highest tier.
INSERT INTO user_badge_history (history_id, user_id, badge_id, badge_tier_id, earned_at, legacy_user_badge_id)
SELECT gen_random_uuid(), legacy_state.user_id, series.badge_id, legacy_state.badge_id,
       legacy_state.earned_at, legacy_state.user_badge_id
FROM user_badges_legacy legacy_state
JOIN badges_legacy legacy_badge USING (badge_id)
JOIN _badge_series_map series USING (condition_type);

-- A current state row records the highest legacy tier. The history insert above
-- preserves every prior tier unlock rather than discarding those associations.
INSERT INTO user_badges (user_badge_id, user_id, badge_id, badge_tier_id, earned_at)
SELECT DISTINCT ON (legacy_state.user_id, series.badge_id)
       gen_random_uuid(), legacy_state.user_id, series.badge_id,
       legacy_badge.badge_id, legacy_state.earned_at
FROM user_badges_legacy legacy_state
JOIN badges_legacy legacy_badge USING (badge_id)
JOIN _badge_series_map series USING (condition_type)
ORDER BY legacy_state.user_id,
         series.badge_id,
         CASE legacy_badge.badge_level
           WHEN 'Bronze' THEN 1 WHEN 'Silver' THEN 2
           WHEN 'Gold' THEN 3 WHEN 'Rainbow' THEN 4
         END DESC,
         legacy_state.earned_at ASC;

DO $verification$
BEGIN
  IF (SELECT COUNT(*) FROM badges_legacy) <> (SELECT COUNT(*) FROM badge_tiers) THEN
    RAISE EXCEPTION 'Badge migration verification failed: legacy badge rows and new tier rows differ';
  END IF;
  IF (SELECT COUNT(*) FROM user_badges_legacy) <> (SELECT COUNT(*) FROM user_badge_history) THEN
    RAISE EXCEPTION 'Badge migration verification failed: legacy unlock rows and history rows differ';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_badge_history history
    LEFT JOIN user_badges current_state
      ON current_state.user_id = history.user_id AND current_state.badge_id = history.badge_id
    WHERE current_state.user_badge_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Badge migration verification failed: an earned history has no current badge state';
  END IF;
END;
$verification$;

CREATE FUNCTION enforce_badge_tier_threshold_order() RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  series_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    series_id := OLD.badge_id;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT required_count,
               LAG(required_count) OVER (ORDER BY tier_level) AS previous_count
        FROM badge_tiers WHERE badge_id = series_id
      ) ordered_tiers
      WHERE previous_count IS NOT NULL AND required_count <= previous_count
    ) THEN
      RAISE EXCEPTION 'Badge tier required_count values must strictly increase with tier_level';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.badge_id IS DISTINCT FROM OLD.badge_id) THEN
    series_id := NEW.badge_id;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT required_count,
               LAG(required_count) OVER (ORDER BY tier_level) AS previous_count
        FROM badge_tiers WHERE badge_id = series_id
      ) ordered_tiers
      WHERE previous_count IS NOT NULL AND required_count <= previous_count
    ) THEN
      RAISE EXCEPTION 'Badge tier required_count values must strictly increase with tier_level';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    series_id := NEW.badge_id;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT required_count,
               LAG(required_count) OVER (ORDER BY tier_level) AS previous_count
        FROM badge_tiers WHERE badge_id = series_id
      ) ordered_tiers
      WHERE previous_count IS NOT NULL AND required_count <= previous_count
    ) THEN
      RAISE EXCEPTION 'Badge tier required_count values must strictly increase with tier_level';
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER trg_badge_tier_threshold_order
AFTER INSERT OR UPDATE OR DELETE ON badge_tiers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_badge_tier_threshold_order();

COMMIT;
