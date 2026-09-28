-- CreateEnum
CREATE TYPE "refill_request_status" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'REFILL_REQUESTED';
ALTER TYPE "notification_type" ADD VALUE 'REFILL_DECIDED';

-- CreateTable
CREATE TABLE "prescription_refill_requests" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "patientNote" VARCHAR(500),
    "status" "refill_request_status" NOT NULL DEFAULT 'PENDING',
    "doctorNote" VARCHAR(500),
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescription_refill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_refill_requests_prescription_id_idx" ON "prescription_refill_requests"("prescription_id");

-- CreateIndex
CREATE INDEX "prescription_refill_requests_status_idx" ON "prescription_refill_requests"("status");

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
