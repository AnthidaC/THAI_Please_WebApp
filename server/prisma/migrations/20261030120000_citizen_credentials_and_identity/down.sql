BEGIN;

-- 1. Delete all CITIZEN_ACCOUNT rows before restoring constraint
DELETE FROM "auth_identities" WHERE "account_type" = 'CITIZEN_ACCOUNT';

-- 2. Revert auth_identities CHECK constraint
ALTER TABLE "auth_identities"
    DROP CONSTRAINT "auth_identities_type_check";

ALTER TABLE "auth_identities"
    ADD CONSTRAINT "auth_identities_type_check"
    CHECK ("account_type" IN ('MERCHANT_APPLICATION', 'STAFF_ACCOUNT'));

-- 3. Drop citizen_credentials table
DROP TABLE IF EXISTS "citizen_credentials";

COMMIT;

