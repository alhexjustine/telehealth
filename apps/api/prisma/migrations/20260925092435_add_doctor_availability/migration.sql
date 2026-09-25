-- AlterTable
ALTER TABLE "doctor_profiles" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_rules_doctor_id_idx" ON "availability_rules"("doctor_id");

-- CreateIndex
CREATE INDEX "availability_exceptions_doctor_id_idx" ON "availability_exceptions"("doctor_id");

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
