ALTER TABLE "rewards"
DROP CONSTRAINT "chk_rewards_quota_limit_nonnegative";

ALTER TABLE "rewards"
DROP COLUMN "quota_limit";
