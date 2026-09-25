-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "patient_profiles" (
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "phone" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "medical_conditions" TEXT,
    "allergies" TEXT,
    "current_medications" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "doctor_profiles" (
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "bio" TEXT,
    "years_of_experience" INTEGER,
    "license_number" TEXT NOT NULL,
    "consultation_minutes" INTEGER NOT NULL DEFAULT 30,
    "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "specializations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "specializations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_specializations" (
    "doctor_id" UUID NOT NULL,
    "specialization_id" UUID NOT NULL,

    CONSTRAINT "doctor_specializations_pkey" PRIMARY KEY ("doctor_id","specialization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profiles_license_number_key" ON "doctor_profiles"("license_number");

-- CreateIndex
CREATE UNIQUE INDEX "specializations_slug_key" ON "specializations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "specializations_name_key" ON "specializations"("name");

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_specializations" ADD CONSTRAINT "doctor_specializations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_specializations" ADD CONSTRAINT "doctor_specializations_specialization_id_fkey" FOREIGN KEY ("specialization_id") REFERENCES "specializations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the specialization catalog with fixed IDs so they are stable across every
-- environment (dev, test, compose) without a separate seeding step, and so later
-- matching-rule changes can reference them by ID.
INSERT INTO "specializations" ("id", "slug", "name", "description") VALUES
    ('59377a7b-de0f-48cc-a665-4f3fa14ea549', 'general-practice', 'General Practice', 'Everyday health concerns, checkups, and referrals to the right specialist.'),
    ('b2cf7501-73f6-474c-819f-f33855012d4c', 'internal-medicine', 'Internal Medicine', 'Diagnosis and treatment of adult illnesses, including chronic conditions.'),
    ('ad6c4b25-4848-4881-9ae2-f2a559250c93', 'pediatrics', 'Pediatrics', 'Health care for infants, children, and adolescents.'),
    ('9774a039-8de3-4674-9f50-957ea52972a4', 'dermatology', 'Dermatology', 'Skin, hair, and nail conditions.'),
    ('0ba9026e-4e84-4bb8-baaf-e88f42b2d12e', 'cardiology', 'Cardiology', 'Heart and blood vessel conditions.'),
    ('a3b810e7-87c0-43c9-83da-5903b5185602', 'neurology', 'Neurology', 'Conditions of the brain, spine, and nervous system.'),
    ('6e4df4a9-22f6-4f7b-b4e5-bdb11a296784', 'psychiatry', 'Psychiatry', 'Mental health assessment and treatment.'),
    ('a6f0cc3f-b579-464d-ada6-ba3aaf337cf4', 'obstetrics-gynecology', 'Obstetrics & Gynecology', 'Pregnancy, childbirth, and reproductive health.'),
    ('38e51b7e-2f73-489f-8a26-6ffa605a0039', 'ent', 'Otolaryngology (ENT)', 'Ear, nose, and throat conditions.'),
    ('f37101a0-c00e-4bfb-953e-b5fe3dac30dd', 'orthopedics', 'Orthopedics', 'Bones, joints, muscles, and ligaments.'),
    ('5acf7dc1-4c07-4bf4-b38f-c2537c9bfb22', 'gastroenterology', 'Gastroenterology', 'Digestive system conditions.'),
    ('1ac5d4f5-7576-443d-9a66-7f16cec3d11a', 'pulmonology', 'Pulmonology', 'Lung and respiratory conditions.'),
    ('9865cac0-513b-4bcd-a74e-8750efe1e3fd', 'endocrinology', 'Endocrinology', 'Hormonal and metabolic conditions, including diabetes and thyroid disorders.');
