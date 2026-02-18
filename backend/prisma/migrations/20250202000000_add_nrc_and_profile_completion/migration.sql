-- Add NRC field and profile completion tracking
ALTER TABLE "users" ADD COLUMN "nrc" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "profile_completed" BOOLEAN NOT NULL DEFAULT false;

-- Create unique index on NRC (case-insensitive, null values allowed)
CREATE UNIQUE INDEX "users_nrc_unique" ON "users" (LOWER("nrc")) WHERE "nrc" IS NOT NULL;

-- Update existing users to have profile_completed = true if they have all required fields
UPDATE "users" 
SET "profile_completed" = true 
WHERE "full_name" IS NOT NULL 
  AND "phone_number" IS NOT NULL 
  AND "school" IS NOT NULL 
  AND "student_number" IS NOT NULL;
