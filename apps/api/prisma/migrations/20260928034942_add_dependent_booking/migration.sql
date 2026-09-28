-- CreateEnum
CREATE TYPE "dependent_relationship" AS ENUM ('CHILD', 'PARENT', 'SPOUSE', 'OTHER');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "dependent_id" UUID;

-- CreateTable
CREATE TABLE "dependents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "relationship" "dependent_relationship" NOT NULL,
    "medical_conditions" TEXT,
    "allergies" TEXT,
    "current_medications" TEXT,
    "removed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dependents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dependents_patient_id_idx" ON "dependents"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_patient_id_dependent_id_idx" ON "appointments"("patient_id", "dependent_id");

-- AddForeignKey
ALTER TABLE "dependents" ADD CONSTRAINT "dependents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dependent_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "dependents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
