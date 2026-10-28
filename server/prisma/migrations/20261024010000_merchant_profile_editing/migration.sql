CREATE TABLE "merchant_location_change_requests" (
    "request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id" UUID NOT NULL,
    "requested_latitude" DECIMAL(10,8) NOT NULL,
    "requested_longitude" DECIMAL(11,8) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_staff_id" UUID,
    "review_note" TEXT,
    CONSTRAINT "merchant_location_change_requests_pkey" PRIMARY KEY ("request_id"),
    CONSTRAINT "merchant_location_change_requests_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT "merchant_location_change_requests_latitude_check" CHECK ("requested_latitude" BETWEEN -90 AND 90),
    CONSTRAINT "merchant_location_change_requests_longitude_check" CHECK ("requested_longitude" BETWEEN -180 AND 180)
);

CREATE INDEX "idx_merchant_location_requests_status_created"
    ON "merchant_location_change_requests"("status", "requested_at");
CREATE INDEX "idx_merchant_location_requests_merchant_status"
    ON "merchant_location_change_requests"("merchant_id", "status");
CREATE UNIQUE INDEX "uq_merchant_location_requests_pending_merchant"
    ON "merchant_location_change_requests"("merchant_id")
    WHERE "status" = 'PENDING';

ALTER TABLE "merchant_location_change_requests"
    ADD CONSTRAINT "fk_merchant_location_requests_merchant"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "merchant_location_change_requests"
    ADD CONSTRAINT "fk_merchant_location_requests_reviewer"
    FOREIGN KEY ("reviewed_by_staff_id") REFERENCES "staff_accounts"("staff_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "merchant_profile_audit_logs" (
    "audit_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_role" VARCHAR(20) NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_profile_audit_logs_pkey" PRIMARY KEY ("audit_id"),
    CONSTRAINT "merchant_profile_audit_logs_actor_role_check" CHECK ("actor_role" IN ('MERCHANT', 'ADMIN', 'STAFF'))
);

CREATE INDEX "idx_merchant_profile_audit_merchant_created"
    ON "merchant_profile_audit_logs"("merchant_id", "created_at");

ALTER TABLE "merchant_profile_audit_logs"
    ADD CONSTRAINT "fk_merchant_profile_audit_merchant"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
