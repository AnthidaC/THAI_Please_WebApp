-- Migration: 20261029220000_referrals_referee_merchant_uniqueness
-- Purpose: Enforce database-level uniqueness on (referred_user_id, merchant_id)
-- Requirement UC 2.4.3: A referee can have only ONE active or redeemed referral per merchant.
-- Cancelled/expired referrals do not block future invitations as long as referee has never paid at that merchant.
-- Partial unique index covers only pending, accepted, and redeemed referrals where referred_user_id IS NOT NULL.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_referrals_referee_merchant"
ON "referrals" ("referred_user_id", "merchant_id")
WHERE "referred_user_id" IS NOT NULL
  AND "status" IN ('pending', 'accepted', 'redeemed');
