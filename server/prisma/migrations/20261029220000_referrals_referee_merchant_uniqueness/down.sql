-- Down Migration: 20261029220000_referrals_referee_merchant_uniqueness
DROP INDEX IF EXISTS "uq_referrals_referee_merchant";
