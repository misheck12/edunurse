-- Add 'student' to the UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'student' BEFORE 'educator';
