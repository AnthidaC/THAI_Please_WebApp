-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "province_code" VARCHAR(10) NOT NULL,
    "is_registered_thai_plus" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "badges" (
    "badge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "badge_name" VARCHAR(100) NOT NULL,
    "badge_level" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "condition_type" VARCHAR(50) NOT NULL,
    "required_count" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("badge_id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "campaign_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_name" VARCHAR(150) NOT NULL,
    "government_copay_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "citizen_payment_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "daily_quota_limit" DECIMAL(10,2) NOT NULL DEFAULT 150,
    "total_quota_limit" DECIMAL(12,2) NOT NULL DEFAULT 3000,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateTable
CREATE TABLE "daily_social_impact_metrics" (
    "social_impact_metric_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "metric_date" DATE NOT NULL,
    "province" VARCHAR(100),
    "new_customers_count" INTEGER NOT NULL DEFAULT 0,
    "successful_referrals_count" INTEGER NOT NULL DEFAULT 0,
    "benefited_merchants_count" INTEGER NOT NULL DEFAULT 0,
    "recommendation_spending_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "referral_spending_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_spending_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_social_impact_metrics_pkey" PRIMARY KEY ("social_impact_metric_id")
);

-- CreateTable
CREATE TABLE "fraud_checks" (
    "fraud_check_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "user_latitude" DECIMAL(10,8) NOT NULL,
    "user_longitude" DECIMAL(11,8) NOT NULL,
    "merchant_latitude" DECIMAL(10,8) NOT NULL,
    "merchant_longitude" DECIMAL(11,8) NOT NULL,
    "distance_meters" DECIMAL(10,2) NOT NULL,
    "is_distance_valid" BOOLEAN NOT NULL DEFAULT true,
    "risk_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fraud_reason" VARCHAR(255),
    "decision" VARCHAR(20) NOT NULL DEFAULT 'AUTO_APPROVED',
    "reviewed_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_checks_pkey" PRIMARY KEY ("fraud_check_id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "merchant_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tax_id" VARCHAR(20) NOT NULL,
    "shop_name" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "average_rating_stars" DECIMAL(2,1) NOT NULL DEFAULT 0.0,
    "digital_credit_score" INTEGER NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("merchant_id")
);

-- CreateTable
CREATE TABLE "quests" (
    "quest_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID,
    "reward_id" UUID,
    "quest_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "quest_type" VARCHAR(50) NOT NULL,
    "target_value" DECIMAL(12,2) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("quest_id")
);

-- CreateTable
CREATE TABLE "recommendation_logs" (
    "recommendation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "user_latitude" DECIMAL(10,8) NOT NULL,
    "user_longitude" DECIMAL(11,8) NOT NULL,
    "recommendation_score" DECIMAL(6,3) NOT NULL,
    "is_clicked" BOOLEAN NOT NULL DEFAULT false,
    "is_converted_to_payment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_logs_pkey" PRIMARY KEY ("recommendation_id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "referral_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_user_id" UUID NOT NULL,
    "referred_user_id" UUID,
    "merchant_id" UUID,
    "transaction_id" UUID,
    "referral_code" VARCHAR(50) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 30.00,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "converted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("referral_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "rating_stars" INTEGER NOT NULL,
    "review_text" TEXT,
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "reward_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reward_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "reward_type" VARCHAR(20) NOT NULL,
    "discount_type" VARCHAR(20),
    "discount_value" DECIMAL(10,2),
    "valid_days" INTEGER NOT NULL DEFAULT 30,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("reward_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "qr_reference" VARCHAR(64),
    "user_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "government_copay_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "citizen_paid_amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "user_badge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "earned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_badge_id")
);

-- CreateTable
CREATE TABLE "user_category_preferences" (
    "preference_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" VARCHAR(50) NOT NULL,
    "preference_weight" DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_category_preferences_pkey" PRIMARY KEY ("preference_id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "user_quest_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "quest_id" UUID NOT NULL,
    "progress_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("user_quest_id")
);

-- CreateTable
CREATE TABLE "user_rewards" (
    "user_reward_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "quest_id" UUID,
    "referral_id" UUID,
    "transaction_id" UUID,
    "reward_code" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "earned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("user_reward_id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "wallet_transaction_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "transaction_id" UUID,
    "transaction_type" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_channel" VARCHAR(30),
    "reference_number" VARCHAR(100),
    "balance_after" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("wallet_transaction_id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "wallet_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "campaign_id" UUID,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "daily_quota_limit" DECIMAL(10,2) NOT NULL DEFAULT 150,
    "daily_quota_used" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "last_quota_reset_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "total_quota_remaining" DECIMAL(12,2) NOT NULL DEFAULT 3000,
    "eligibility_status" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_citizen_id_hash" ON "users"("citizen_id_hash");

-- CreateIndex
CREATE INDEX "idx_users_province_code" ON "users"("province_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_badges_level_condition" ON "badges"("badge_level", "condition_type");

-- CreateIndex
CREATE INDEX "idx_campaigns_date_range" ON "campaigns"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_campaigns_status" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "idx_daily_social_impact_metrics_date" ON "daily_social_impact_metrics"("metric_date");

-- CreateIndex
CREATE INDEX "idx_daily_social_impact_metrics_province" ON "daily_social_impact_metrics"("province");

-- CreateIndex
CREATE UNIQUE INDEX "uq_daily_social_impact_metrics_date_province" ON "daily_social_impact_metrics"("metric_date", "province");

-- CreateIndex
CREATE UNIQUE INDEX "uq_fraud_checks_transaction" ON "fraud_checks"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_fraud_checks_decision" ON "fraud_checks"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "uq_merchants_tax_id" ON "merchants"("tax_id");

-- CreateIndex
CREATE INDEX "idx_merchants_location" ON "merchants"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "idx_quests_campaign" ON "quests"("campaign_id");

-- CreateIndex
CREATE INDEX "idx_quests_date_range" ON "quests"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "idx_quests_reward" ON "quests"("reward_id");

-- CreateIndex
CREATE INDEX "idx_quests_status" ON "quests"("status");

-- CreateIndex
CREATE INDEX "idx_recommendation_logs_conversion" ON "recommendation_logs"("is_clicked", "is_converted_to_payment");

-- CreateIndex
CREATE INDEX "idx_recommendation_logs_merchant" ON "recommendation_logs"("merchant_id");

-- CreateIndex
CREATE INDEX "idx_recommendation_logs_user_created_at" ON "recommendation_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referrals_referral_code" ON "referrals"("referral_code");

-- CreateIndex
CREATE INDEX "idx_referrals_expires_at" ON "referrals"("expires_at");

-- CreateIndex
CREATE INDEX "idx_referrals_merchant" ON "referrals"("merchant_id");

-- CreateIndex
CREATE INDEX "idx_referrals_referred" ON "referrals"("referred_user_id");

-- CreateIndex
CREATE INDEX "idx_referrals_referrer" ON "referrals"("referrer_user_id");

-- CreateIndex
CREATE INDEX "idx_referrals_status" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "idx_referrals_transaction" ON "referrals"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_reviews_transaction" ON "reviews"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_reviews_merchant_created_at" ON "reviews"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_reviews_merchant_rating" ON "reviews"("merchant_id", "rating_stars");

-- CreateIndex
CREATE INDEX "idx_reviews_user" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "idx_transactions_merchant_created_at" ON "transactions"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_transactions_qr_reference" ON "transactions"("qr_reference");

-- CreateIndex
CREATE INDEX "idx_transactions_status" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "idx_transactions_user_created_at" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_user_badges_badge" ON "user_badges"("badge_id");

-- CreateIndex
CREATE INDEX "idx_user_badges_user" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_badges_user_badge" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "idx_user_category_preferences_user" ON "user_category_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_category_preferences_user_category" ON "user_category_preferences"("user_id", "category_id");

-- CreateIndex
CREATE INDEX "idx_user_quests_quest" ON "user_quests"("quest_id");

-- CreateIndex
CREATE INDEX "idx_user_quests_status" ON "user_quests"("status");

-- CreateIndex
CREATE INDEX "idx_user_quests_user" ON "user_quests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_quests_user_quest" ON "user_quests"("user_id", "quest_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_rewards_reward_code" ON "user_rewards"("reward_code");

-- CreateIndex
CREATE INDEX "idx_user_rewards_quest" ON "user_rewards"("quest_id");

-- CreateIndex
CREATE INDEX "idx_user_rewards_referral" ON "user_rewards"("referral_id");

-- CreateIndex
CREATE INDEX "idx_user_rewards_reward" ON "user_rewards"("reward_id");

-- CreateIndex
CREATE INDEX "idx_user_rewards_status" ON "user_rewards"("status");

-- CreateIndex
CREATE INDEX "idx_user_rewards_transaction" ON "user_rewards"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_user_rewards_user" ON "user_rewards"("user_id");

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_reference_number" ON "wallet_transactions"("reference_number");

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_transaction" ON "wallet_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_wallet_created_at" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallets_user" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "idx_wallets_campaign" ON "wallets"("campaign_id");

-- CreateIndex
CREATE INDEX "idx_wallets_status" ON "wallets"("status");

-- AddForeignKey
ALTER TABLE "fraud_checks" ADD CONSTRAINT "fk_fraud_checks_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "fk_quests_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "fk_quests_reward" FOREIGN KEY ("reward_id") REFERENCES "rewards"("reward_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recommendation_logs" ADD CONSTRAINT "fk_recommendation_logs_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recommendation_logs" ADD CONSTRAINT "fk_recommendation_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "fk_referrals_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "fk_referrals_referred" FOREIGN KEY ("referred_user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "fk_referrals_referrer" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "fk_referrals_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "fk_transactions_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "fk_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "fk_user_badges_badge" FOREIGN KEY ("badge_id") REFERENCES "badges"("badge_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "fk_user_badges_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_category_preferences" ADD CONSTRAINT "fk_user_category_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "fk_user_quests_quest" FOREIGN KEY ("quest_id") REFERENCES "quests"("quest_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "fk_user_quests_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "fk_user_rewards_quest" FOREIGN KEY ("quest_id") REFERENCES "quests"("quest_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "fk_user_rewards_referral" FOREIGN KEY ("referral_id") REFERENCES "referrals"("referral_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "fk_user_rewards_reward" FOREIGN KEY ("reward_id") REFERENCES "rewards"("reward_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "fk_user_rewards_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "fk_user_rewards_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "fk_wallet_transactions_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "fk_wallet_transactions_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("wallet_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "fk_wallets_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "fk_wallets_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

