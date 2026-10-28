-- Separate staff access into administrative and government executive roles.
UPDATE "staff_accounts"
SET "role" = 'ADMIN'
WHERE "role" = 'STAFF';

ALTER TABLE "staff_accounts"
  DROP CONSTRAINT "staff_accounts_role_check";

ALTER TABLE "staff_accounts"
  ADD CONSTRAINT "staff_accounts_role_check"
  CHECK ("role" IN ('ADMIN', 'GOVERNMENT_EXECUTIVE'));

-- Central registry for all password-based identities. Citizens continue to use ThaiD/NDID.
CREATE TABLE "auth_identities" (
  "email" VARCHAR(254) NOT NULL,
  "account_type" VARCHAR(30) NOT NULL,
  "account_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("email"),
  CONSTRAINT "auth_identities_email_normalized_check"
    CHECK ("email" = lower("email")),
  CONSTRAINT "auth_identities_type_check"
    CHECK ("account_type" IN ('MERCHANT_APPLICATION', 'STAFF_ACCOUNT')),
  CONSTRAINT "auth_identities_account_unique"
    UNIQUE ("account_type", "account_id")
);

-- Backfill only merchant applications that can still be used to log in.
INSERT INTO "auth_identities" ("email", "account_type", "account_id")
SELECT lower(email), 'MERCHANT_APPLICATION', application_id
FROM "merchant_applications"
WHERE "status" IN ('SUBMITTING', 'PENDING', 'APPROVED');

INSERT INTO "auth_identities" ("email", "account_type", "account_id")
SELECT lower(email), 'STAFF_ACCOUNT', staff_id
FROM "staff_accounts";

CREATE OR REPLACE FUNCTION "sync_auth_identity_from_merchant_application"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "auth_identities"
    WHERE "account_type" = 'MERCHANT_APPLICATION'
      AND "account_id" = OLD.application_id;
    RETURN OLD;
  END IF;

  DELETE FROM "auth_identities"
  WHERE "account_type" = 'MERCHANT_APPLICATION'
    AND "account_id" = NEW.application_id;

  IF NEW.status IN ('SUBMITTING', 'PENDING', 'APPROVED') THEN
    INSERT INTO "auth_identities" ("email", "account_type", "account_id")
    VALUES (lower(trim(NEW.email)), 'MERCHANT_APPLICATION', NEW.application_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "merchant_applications_sync_auth_identity"
AFTER INSERT OR UPDATE OF "email", "status" OR DELETE
ON "merchant_applications"
FOR EACH ROW
EXECUTE FUNCTION "sync_auth_identity_from_merchant_application"();

CREATE OR REPLACE FUNCTION "sync_auth_identity_from_staff_account"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "auth_identities"
    WHERE "account_type" = 'STAFF_ACCOUNT'
      AND "account_id" = OLD.staff_id;
    RETURN OLD;
  END IF;

  DELETE FROM "auth_identities"
  WHERE "account_type" = 'STAFF_ACCOUNT'
    AND "account_id" = NEW.staff_id;

  INSERT INTO "auth_identities" ("email", "account_type", "account_id")
  VALUES (lower(trim(NEW.email)), 'STAFF_ACCOUNT', NEW.staff_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER "staff_accounts_sync_auth_identity"
AFTER INSERT OR UPDATE OF "email" OR DELETE
ON "staff_accounts"
FOR EACH ROW
EXECUTE FUNCTION "sync_auth_identity_from_staff_account"();
