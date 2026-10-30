ALTER TABLE "rewards"
ADD COLUMN "minimum_spend" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "rewards"
SET "minimum_spend" = CASE
  WHEN "discount_type" = 'percent'
    THEN GREATEST(COALESCE("discount_value", 10) * 10, 100)
  ELSE GREATEST(COALESCE("discount_value", 30) * 4, 100)
END;

ALTER TABLE "rewards"
ADD CONSTRAINT "chk_rewards_minimum_spend_nonnegative"
CHECK ("minimum_spend" >= 0);
