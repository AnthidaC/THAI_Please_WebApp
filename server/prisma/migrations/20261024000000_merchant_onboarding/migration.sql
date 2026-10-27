CREATE TABLE "staff_accounts" (
    "staff_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("staff_id"),
    CONSTRAINT "staff_accounts_role_check" CHECK ("role" IN ('ADMIN', 'STAFF'))
);

CREATE UNIQUE INDEX "uq_staff_accounts_email" ON "staff_accounts"("email");

CREATE TABLE "merchant_applications" (
    "application_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_type" VARCHAR(20) NOT NULL,
    "tax_id" VARCHAR(20) NOT NULL,
    "shop_name" VARCHAR(100) NOT NULL,
    "contact_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUBMITTING',
    "rejection_reason" TEXT,
    "merchant_id" UUID,
    "reviewed_by_staff_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    CONSTRAINT "merchant_applications_pkey" PRIMARY KEY ("application_id"),
    CONSTRAINT "merchant_applications_business_type_check" CHECK ("business_type" IN ('INDIVIDUAL', 'JURISTIC')),
    CONSTRAINT "merchant_applications_status_check" CHECK ("status" IN ('SUBMITTING', 'PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT "merchant_applications_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "merchant_applications_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE UNIQUE INDEX "uq_merchant_applications_merchant" ON "merchant_applications"("merchant_id");
CREATE INDEX "idx_merchant_applications_status_created" ON "merchant_applications"("status", "created_at");
CREATE INDEX "idx_merchant_applications_email" ON "merchant_applications"("email");
CREATE UNIQUE INDEX "uq_merchant_applications_active_email"
    ON "merchant_applications"("email")
    WHERE "status" IN ('SUBMITTING', 'PENDING', 'APPROVED');

ALTER TABLE "merchant_applications"
    ADD CONSTRAINT "fk_merchant_applications_merchant"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "merchant_applications"
    ADD CONSTRAINT "fk_merchant_applications_reviewer"
    FOREIGN KEY ("reviewed_by_staff_id") REFERENCES "staff_accounts"("staff_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "merchant_application_documents" (
    "document_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "document_type" VARCHAR(40) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_application_documents_pkey" PRIMARY KEY ("document_id")
);

CREATE UNIQUE INDEX "uq_merchant_application_documents_path" ON "merchant_application_documents"("storage_path");
CREATE UNIQUE INDEX "uq_merchant_application_documents_type" ON "merchant_application_documents"("application_id", "document_type");
CREATE INDEX "idx_merchant_application_documents_application" ON "merchant_application_documents"("application_id");

ALTER TABLE "merchant_application_documents"
    ADD CONSTRAINT "fk_merchant_application_documents_application"
    FOREIGN KEY ("application_id") REFERENCES "merchant_applications"("application_id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "merchant_application_audit_logs" (
    "audit_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_application_audit_logs_pkey" PRIMARY KEY ("audit_id"),
    CONSTRAINT "merchant_application_audit_action_check" CHECK ("action" IN ('APPROVE', 'REJECT'))
);

CREATE INDEX "idx_merchant_application_audit_application_created"
    ON "merchant_application_audit_logs"("application_id", "created_at");

ALTER TABLE "merchant_application_audit_logs"
    ADD CONSTRAINT "fk_merchant_application_audit_application"
    FOREIGN KEY ("application_id") REFERENCES "merchant_applications"("application_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "merchant_application_audit_logs"
    ADD CONSTRAINT "fk_merchant_application_audit_staff"
    FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("staff_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
