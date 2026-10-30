BEGIN;

-- 1. Create table citizen_credentials
CREATE TABLE "citizen_credentials" (
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "citizen_credentials_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "fk_citizen_credentials_user" FOREIGN KEY ("user_id")
        REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- RLS & Security for citizen_credentials
ALTER TABLE "citizen_credentials" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "citizen_credentials" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "citizen_credentials" FROM authenticated;
  END IF;
END $$;

-- 2. Expand auth_identities CHECK constraint to allow CITIZEN_ACCOUNT
ALTER TABLE "auth_identities"
    DROP CONSTRAINT "auth_identities_type_check";

ALTER TABLE "auth_identities"
    ADD CONSTRAINT "auth_identities_type_check"
    CHECK ("account_type" IN ('MERCHANT_APPLICATION', 'STAFF_ACCOUNT', 'CITIZEN_ACCOUNT'));

COMMIT;

