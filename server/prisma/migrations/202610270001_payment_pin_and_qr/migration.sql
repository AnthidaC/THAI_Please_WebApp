-- Additive migration: no changes to the login tables or existing transactions.
BEGIN;
CREATE TABLE "payment_pins" (
    "user_id" UUID NOT NULL PRIMARY KEY REFERENCES "users"("user_id") ON DELETE CASCADE,
    "pin_hash" VARCHAR(255) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "payment_qr_codes" (
    "qr_reference" VARCHAR(64) NOT NULL PRIMARY KEY,
    "merchant_id" UUID NOT NULL REFERENCES "merchants"("merchant_id"),
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "payment_qr_codes_expires_at_idx" ON "payment_qr_codes"("expires_at");

-- These tables are accessed only by the server's database connection, never the public Data API.
ALTER TABLE "payment_pins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_qr_codes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "payment_pins", "payment_qr_codes" FROM anon, authenticated;

-- A declined GPS attempt may share a reference; only one actual payment may succeed.
CREATE UNIQUE INDEX "uq_transactions_paid_qr_reference" ON "transactions"("qr_reference")
WHERE "qr_reference" IS NOT NULL AND "status" IN ('SUCCESS', 'FLAGGED');
COMMIT;
