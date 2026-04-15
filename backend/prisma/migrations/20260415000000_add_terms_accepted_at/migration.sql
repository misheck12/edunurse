-- AlterTable: Add terms_accepted_at to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMPTZ(6);
