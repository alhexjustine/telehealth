-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('BOOKED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'BOOKED',
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancellation_reason" VARCHAR(500),
    "rescheduled_from_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_symptoms" (
    "appointment_id" UUID NOT NULL,
    "symptom_id" UUID NOT NULL,

    CONSTRAINT "appointment_symptoms_pkey" PRIMARY KEY ("appointment_id","symptom_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointments_rescheduled_from_id_key" ON "appointments"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_starts_at_idx" ON "appointments"("doctor_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_patient_id_starts_at_idx" ON "appointments"("patient_id", "starts_at");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_symptoms" ADD CONSTRAINT "appointment_symptoms_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_symptoms" ADD CONSTRAINT "appointment_symptoms_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guarantees no doctor and no patient can ever have two overlapping BOOKED
-- appointments, even under concurrent requests — the database is the final
-- guard behind the service-level checks in BookingRules. Expressed here in
-- raw SQL because Prisma's schema language can't declare an EXCLUDE
-- constraint; btree_gist (required for the `=` operator class in a GiST
-- exclusion constraint) was enabled by the very first migration. The `[)`
-- half-open range lets back-to-back appointments touch without overlapping.
-- Restricted to `status = 'BOOKED'` so rescheduling (cancel the old row,
-- insert a new one, in the same transaction) can freely reuse the old time,
-- and so a CANCELLED row never blocks a new booking at the same time.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_no_overlap"
  EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status = 'BOOKED');

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_no_overlap"
  EXCLUDE USING gist (patient_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status = 'BOOKED');

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_valid_range"
  CHECK (ends_at > starts_at);
