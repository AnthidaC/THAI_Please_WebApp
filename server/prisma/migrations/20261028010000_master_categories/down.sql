-- Drop Foreign Keys
ALTER TABLE "user_category_preferences" DROP CONSTRAINT IF EXISTS "fk_user_category_preferences_category";
DROP INDEX IF EXISTS "idx_user_category_preferences_category_id";

ALTER TABLE "merchant_applications" DROP CONSTRAINT IF EXISTS "fk_merchant_applications_category";

ALTER TABLE "merchants" DROP CONSTRAINT IF EXISTS "fk_merchants_category";

-- Drop Master Table
DROP TABLE IF EXISTS "categories";
