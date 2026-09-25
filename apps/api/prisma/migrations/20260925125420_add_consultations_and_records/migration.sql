-- CreateEnum
CREATE TYPE "session_state" AS ENUM ('SCHEDULED', 'JOINED', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'CONSULTATION_SUMMARY_AVAILABLE';

-- CreateTable
CREATE TABLE "consultation_sessions" (
    "appointment_id" UUID NOT NULL,
    "state" "session_state" NOT NULL DEFAULT 'SCHEDULED',
    "patient_joined_at" TIMESTAMPTZ(3),
    "doctor_joined_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultation_sessions_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "consultation_notes" (
    "appointment_id" UUID NOT NULL,
    "findings" VARCHAR(4000),
    "assessment" VARCHAR(4000),
    "plan" VARCHAR(4000),
    "patient_summary" VARCHAR(4000),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultation_notes_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "medication" VARCHAR(120) NOT NULL,
    "dosage" VARCHAR(60) NOT NULL,
    "frequency" VARCHAR(60) NOT NULL,
    "duration" VARCHAR(60) NOT NULL,
    "instructions" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_appointment_id_idx" ON "prescriptions"("appointment_id");

-- AddForeignKey
ALTER TABLE "consultation_sessions" ADD CONSTRAINT "consultation_sessions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
