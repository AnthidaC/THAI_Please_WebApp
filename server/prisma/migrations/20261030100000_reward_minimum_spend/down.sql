ALTER TABLE "rewards"
DROP CONSTRAINT "chk_rewards_minimum_spend_nonnegative";

ALTER TABLE "rewards"
DROP COLUMN "minimum_spend";
