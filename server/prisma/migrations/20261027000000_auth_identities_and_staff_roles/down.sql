-- Prisma Migrate does not run down.sql automatically. Run only through a reviewed rollback procedure.
DROP TRIGGER IF EXISTS "merchant_applications_sync_auth_identity" ON "merchant_applications";
DROP TRIGGER IF EXISTS "staff_accounts_sync_auth_identity" ON "staff_accounts";

DROP FUNCTION IF EXISTS "sync_auth_identity_from_merchant_application"();
DROP FUNCTION IF EXISTS "sync_auth_identity_from_staff_account"();

DROP TABLE IF EXISTS "auth_identities";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "staff_accounts"
    WHERE "role" = 'GOVERNMENT_EXECUTIVE'
  ) THEN
    RAISE EXCEPTION
      'Rollback blocked: GOVERNMENT_EXECUTIVE accounts must be reassigned first';
  END IF;
END;
$$;

ALTER TABLE "staff_accounts"
  DROP CONSTRAINT "staff_accounts_role_check";

ALTER TABLE "staff_accounts"
  ADD CONSTRAINT "staff_accounts_role_check"
  CHECK ("role" IN ('ADMIN', 'STAFF'));
