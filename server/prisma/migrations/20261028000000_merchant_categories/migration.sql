-- AlterTable merchants: Add nullable category_id
ALTER TABLE "merchants" ADD COLUMN "category_id" VARCHAR(50);

-- AlterTable merchant_applications: Add nullable category_id
ALTER TABLE "merchant_applications" ADD COLUMN "category_id" VARCHAR(50);

-- CreateCheckConstraint on merchants: Limit to Canonical Category IDs
ALTER TABLE "merchants" ADD CONSTRAINT "chk_merchants_category_id" 
    CHECK ("category_id" IS NULL OR "category_id" IN ('FOOD', 'STREET_FOOD', 'BAKERY_DESSERT', 'BEVERAGE', 'GENERAL_GOODS'));

-- CreateCheckConstraint on merchant_applications: Limit to Canonical Category IDs
ALTER TABLE "merchant_applications" ADD CONSTRAINT "chk_merchant_applications_category_id" 
    CHECK ("category_id" IS NULL OR "category_id" IN ('FOOD', 'STREET_FOOD', 'BAKERY_DESSERT', 'BEVERAGE', 'GENERAL_GOODS'));

-- CreateIndex on merchants(category_id)
CREATE INDEX "idx_merchants_category_id" ON "merchants"("category_id");

-- CreateIndex on merchant_applications(category_id)
CREATE INDEX "idx_merchant_applications_category_id" ON "merchant_applications"("category_id");
