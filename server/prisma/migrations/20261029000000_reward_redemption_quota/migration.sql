ALTER TABLE "rewards"
ADD COLUMN "quota_limit" INTEGER;

ALTER TABLE "rewards"
ADD CONSTRAINT "chk_rewards_quota_limit_nonnegative"
CHECK ("quota_limit" IS NULL OR "quota_limit" >= 0);
