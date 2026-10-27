CREATE INDEX "idx_transactions_status_completed_at"
    ON "transactions"("status", "completed_at");
CREATE INDEX "idx_transactions_status_created_at"
    ON "transactions"("status", "created_at");
