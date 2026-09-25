-- AlterEnum
ALTER TYPE "appointment_status" ADD VALUE 'NOT_HELD';

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'PROFILE_APPROVED';
ALTER TYPE "notification_type" ADD VALUE 'PROFILE_REJECTED';
ALTER TYPE "notification_type" ADD VALUE 'PLATFORM_APPOINTMENT_CANCELLED';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "resolution_reason" VARCHAR(500);
