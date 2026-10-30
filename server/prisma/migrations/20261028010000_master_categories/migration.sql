-- CreateTable: categories
CREATE TABLE "categories" (
    "category_id" VARCHAR(50) NOT NULL,
    "category_name_th" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- Seed canonical master categories
INSERT INTO "categories" ("category_id", "category_name_th", "is_active") VALUES
    ('FOOD', 'ร้านอาหารทั่วไป', true),
    ('STREET_FOOD', 'อาหารริมทาง', true),
    ('BAKERY_DESSERT', 'ขนมหวานและเบเกอรี่', true),
    ('BEVERAGE', 'เครื่องดื่ม', true),
    ('GENERAL_GOODS', 'สินค้าทั่วไป', true)
ON CONFLICT ("category_id") DO UPDATE 
SET "category_name_th" = EXCLUDED."category_name_th",
    "is_active" = EXCLUDED."is_active";

-- AddForeignKey: merchants -> categories
ALTER TABLE "merchants" ADD CONSTRAINT "fk_merchants_category" 
    FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") 
    ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey: merchant_applications -> categories
ALTER TABLE "merchant_applications" ADD CONSTRAINT "fk_merchant_applications_category" 
    FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") 
    ON DELETE RESTRICT ON UPDATE NO ACTION;

-- CreateIndex on user_category_preferences(category_id)
CREATE INDEX IF NOT EXISTS "idx_user_category_preferences_category_id" ON "user_category_preferences"("category_id");

-- AddForeignKey: user_category_preferences -> categories
ALTER TABLE "user_category_preferences" ADD CONSTRAINT "fk_user_category_preferences_category" 
    FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") 
    ON DELETE CASCADE ON UPDATE NO ACTION;
