-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "error_detail" TEXT,
    "sent_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_user_id_created_at_idx" ON "notification_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_channel_created_at_idx" ON "notification_logs"("channel", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
