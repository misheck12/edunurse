CREATE TABLE "service_controls" (
    "service_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_controls_pkey" PRIMARY KEY ("service_key")
);

CREATE INDEX "service_controls_updated_by_user_id_idx" ON "service_controls"("updated_by_user_id");

ALTER TABLE "service_controls"
ADD CONSTRAINT "service_controls_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
