-- CreateTable
CREATE TABLE "symptoms" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL,
    "is_red_flag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptom_specializations" (
    "symptom_id" UUID NOT NULL,
    "specialization_id" UUID NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "symptom_specializations_pkey" PRIMARY KEY ("symptom_id","specialization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_slug_key" ON "symptoms"("slug");

-- AddForeignKey
ALTER TABLE "symptom_specializations" ADD CONSTRAINT "symptom_specializations_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptom_specializations" ADD CONSTRAINT "symptom_specializations_specialization_id_fkey" FOREIGN KEY ("specialization_id") REFERENCES "specializations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the symptom catalog: fixed UUIDs so they are stable across every
-- environment without a separate seeding step. See design.md's "Symptom
-- catalog as a data migration".
INSERT INTO "symptoms" ("id", "slug", "name", "category", "keywords", "is_red_flag") VALUES
    ('4e92b1ab-3ba1-4f4b-9dfc-8955de937a0d', 'headache', 'Headache', 'Head & Neurological', ARRAY['headache', 'migraine']::TEXT[], false),
    ('5d8c1288-83bf-4896-8de9-542db3226db8', 'dizziness', 'Dizziness', 'Head & Neurological', ARRAY['dizziness', 'dizzy', 'lightheaded']::TEXT[], false),
    ('7f5cd14d-35ae-442b-8b53-d58e9f6cecfd', 'numbness-or-tingling', 'Numbness or tingling', 'Head & Neurological', ARRAY['numbness', 'tingling', 'pins and needles']::TEXT[], false),
    ('ecfa071c-724f-47ec-9277-c57c0a71dce7', 'memory-problems', 'Memory problems', 'Head & Neurological', ARRAY['memory problems', 'forgetfulness', 'confusion']::TEXT[], false),
    ('f6d13bda-51ff-4e67-9f27-f3d457b41a51', 'tremor', 'Tremor', 'Head & Neurological', ARRAY['tremor', 'shaking hands']::TEXT[], false),
    ('d0820443-5e1a-4de9-aebd-2542142c93df', 'cough', 'Cough', 'Respiratory', ARRAY['cough', 'coughing']::TEXT[], false),
    ('f2ad23ae-1d88-47de-8ee1-1e5c2adf6e56', 'shortness-of-breath', 'Shortness of breath', 'Respiratory', ARRAY['shortness of breath', 'breathless', 'winded']::TEXT[], false),
    ('8fc838f1-b5f8-415f-a666-1ca1d8868302', 'wheezing', 'Wheezing', 'Respiratory', ARRAY['wheezing', 'wheeze']::TEXT[], false),
    ('2fcd2bef-c5ad-4539-96c4-3784f28c83b8', 'chest-congestion', 'Chest congestion', 'Respiratory', ARRAY['chest congestion', 'congested chest']::TEXT[], false),
    ('545f2383-a367-4464-8166-cb9ba1eee014', 'chest-pain', 'Chest pain', 'Heart & Circulation', ARRAY['chest pain', 'chest tightness']::TEXT[], true),
    ('11fd418f-39a9-4855-9fe3-fdc23d5d53ae', 'palpitations', 'Palpitations', 'Heart & Circulation', ARRAY['palpitations', 'racing heart', 'heart pounding']::TEXT[], false),
    ('f8f46428-7c8e-43e5-862d-322bddd3bea4', 'swelling-in-legs-or-ankles', 'Swelling in legs or ankles', 'Heart & Circulation', ARRAY['swollen legs', 'ankle swelling', 'leg swelling']::TEXT[], false),
    ('e11a3a82-c0b4-47ae-a289-fabb83d13481', 'fainting-or-lightheadedness', 'Fainting or lightheadedness', 'Heart & Circulation', ARRAY['fainting', 'near fainting', 'feeling faint']::TEXT[], false),
    ('88f62376-be2f-4fda-881d-1c56e057d6fc', 'abdominal-pain', 'Abdominal pain', 'Digestive', ARRAY['abdominal pain', 'stomach ache', 'stomach pain']::TEXT[], false),
    ('226efaad-93f5-4e64-992f-3e134c4e4d2e', 'nausea-and-vomiting', 'Nausea and vomiting', 'Digestive', ARRAY['nausea', 'vomiting', 'throwing up']::TEXT[], false),
    ('24e6729d-d242-45c2-8833-ffca7a47ffc8', 'diarrhea', 'Diarrhea', 'Digestive', ARRAY['diarrhea', 'loose stools']::TEXT[], false),
    ('6bf550b9-bea1-4e3e-b04b-18fe225a66ba', 'heartburn', 'Heartburn', 'Digestive', ARRAY['heartburn', 'acid reflux', 'indigestion']::TEXT[], false),
    ('48217010-7459-4488-89a9-2899f2880bd9', 'skin-rash', 'Skin rash', 'Skin', ARRAY['rash', 'hives', 'itchy skin']::TEXT[], false),
    ('f0cc2fe2-a160-4466-9e1d-9cd571569649', 'acne', 'Acne', 'Skin', ARRAY['acne', 'pimples', 'breakouts']::TEXT[], false),
    ('80ddd1b6-e92f-443d-87c6-fdaec8c83034', 'hair-loss', 'Hair loss', 'Skin', ARRAY['hair loss', 'thinning hair', 'balding']::TEXT[], false),
    ('2ec829b3-2157-4a0a-b2ff-3a96173fe7f4', 'mole-changes', 'Mole changes', 'Skin', ARRAY['mole changes', 'changing mole', 'new mole']::TEXT[], false),
    ('a58de7f1-c74c-4b2d-98bc-51e35736ebb2', 'anxiety', 'Anxiety', 'Mental Health', ARRAY['anxiety', 'anxious', 'panic']::TEXT[], false),
    ('5e12e01e-47f6-475a-902c-01478056415a', 'low-mood', 'Low mood', 'Mental Health', ARRAY['low mood', 'feeling down', 'sadness']::TEXT[], false),
    ('d751879a-5af4-4848-9e41-ac17b05f8f7f', 'trouble-sleeping', 'Trouble sleeping', 'Mental Health', ARRAY['trouble sleeping', 'insomnia', 'cant sleep']::TEXT[], false),
    ('757d26da-9c0d-449a-8996-235710d4e30b', 'difficulty-concentrating', 'Difficulty concentrating', 'Mental Health', ARRAY['difficulty concentrating', 'trouble focusing', 'poor concentration']::TEXT[], false),
    ('9392d248-f40b-4a27-8f0c-b60e9bb2710a', 'joint-pain', 'Joint pain', 'Musculoskeletal', ARRAY['joint pain', 'aching joints']::TEXT[], false),
    ('1dc009b4-9ff6-45a9-9ab8-e70884c223b1', 'back-pain', 'Back pain', 'Musculoskeletal', ARRAY['back pain', 'backache']::TEXT[], false),
    ('befe3782-e6cd-48f0-b006-d8766a3a60e3', 'muscle-strain', 'Muscle strain', 'Musculoskeletal', ARRAY['muscle strain', 'pulled muscle', 'muscle pain']::TEXT[], false),
    ('129d7488-88e5-4916-9352-7c424f5130ad', 'neck-stiffness', 'Neck stiffness', 'Musculoskeletal', ARRAY['neck stiffness', 'stiff neck']::TEXT[], false),
    ('3eda7944-d2b2-4658-844b-299ad4b41519', 'sore-throat', 'Sore throat', 'Ear, Nose & Throat', ARRAY['sore throat', 'throat pain']::TEXT[], false),
    ('470c15ec-e0d8-4c3d-ae84-d65582604b99', 'ear-pain', 'Ear pain', 'Ear, Nose & Throat', ARRAY['ear pain', 'earache']::TEXT[], false),
    ('6673555a-2977-4c32-aa4f-f3c5401fc045', 'nasal-congestion', 'Nasal congestion', 'Ear, Nose & Throat', ARRAY['nasal congestion', 'stuffy nose', 'blocked nose']::TEXT[], false),
    ('2fda891f-fdfd-4e93-b909-a390248d37d7', 'ringing-in-ears', 'Ringing in ears', 'Ear, Nose & Throat', ARRAY['ringing in ears', 'tinnitus']::TEXT[], false),
    ('2e38ae9c-c39a-4735-9e75-233989a99cab', 'excessive-thirst', 'Excessive thirst', 'Hormonal & Metabolic', ARRAY['excessive thirst', 'always thirsty']::TEXT[], false),
    ('5943ce63-2ef0-47d6-8b0e-b43869798338', 'unexplained-weight-change', 'Unexplained weight change', 'Hormonal & Metabolic', ARRAY['unexplained weight loss', 'unexplained weight gain']::TEXT[], false),
    ('995bab26-ed39-401f-9eee-b156efadf4eb', 'heat-or-cold-intolerance', 'Heat or cold intolerance', 'Hormonal & Metabolic', ARRAY['heat intolerance', 'cold intolerance']::TEXT[], false),
    ('81698484-cfd6-4e81-8942-ec22791b821d', 'increased-urination', 'Increased urination', 'Hormonal & Metabolic', ARRAY['frequent urination', 'increased urination']::TEXT[], false),
    ('76692741-ac51-4163-8e47-7a296f039e75', 'menstrual-irregularities', 'Menstrual irregularities', 'Women''s Health', ARRAY['irregular periods', 'missed period', 'menstrual irregularities']::TEXT[], false),
    ('39c9b460-a018-4d61-8bb7-e7b623786be3', 'pelvic-pain', 'Pelvic pain', 'Women''s Health', ARRAY['pelvic pain']::TEXT[], false),
    ('3ac9dd9e-72f7-4797-a39a-43204a961d3d', 'pregnancy-related-nausea', 'Pregnancy-related nausea', 'Women''s Health', ARRAY['morning sickness', 'pregnancy nausea']::TEXT[], false),
    ('a964c140-34c6-41d6-99b7-b50ebf37271b', 'breast-lump', 'Breast lump', 'Women''s Health', ARRAY['breast lump', 'lump in breast']::TEXT[], false),
    ('1713e7ad-6d50-497f-80ca-8bff84199874', 'fatigue', 'Fatigue', 'General', ARRAY['fatigue', 'tiredness', 'low energy']::TEXT[], false),
    ('02c51a51-d508-4641-97ad-390b09db3230', 'fever', 'Fever', 'General', ARRAY['fever', 'high temperature']::TEXT[], false),
    ('996f5b00-a0bb-45a1-be9d-fbf0f861442f', 'growth-or-developmental-concern', 'Growth or developmental concern', 'General', ARRAY['growth concern', 'developmental delay']::TEXT[], false),
    ('13fd13ca-4398-4ed8-8919-aa4070808528', 'persistent-minor-illnesses', 'Persistent minor illnesses', 'General', ARRAY['frequent infections', 'getting sick often']::TEXT[], false),
    ('8a96a269-8ce6-4c4a-b403-7f08b88e856d', 'difficulty-breathing', 'Difficulty breathing', 'Emergency Warning Signs', ARRAY['difficulty breathing', 'cant breathe', 'struggling to breathe']::TEXT[], true),
    ('868501a6-2444-4edf-9048-94053f865693', 'severe-bleeding', 'Severe bleeding', 'Emergency Warning Signs', ARRAY['severe bleeding', 'heavy bleeding', 'uncontrolled bleeding']::TEXT[], true),
    ('f5cbe0b3-3fb2-4acb-b3cb-07ceea10a096', 'sudden-weakness-or-numbness-one-side', 'Sudden weakness or numbness on one side', 'Emergency Warning Signs', ARRAY['sudden weakness one side', 'sudden numbness one side', 'face drooping']::TEXT[], true),
    ('4b649cc3-a740-486e-a90b-8c275d91fb49', 'sudden-severe-headache', 'Sudden severe headache', 'Emergency Warning Signs', ARRAY['sudden severe headache', 'worst headache']::TEXT[], true),
    ('5009e301-8c2e-40ad-a353-07f9c8a3eefc', 'thoughts-of-self-harm', 'Thoughts of self-harm', 'Emergency Warning Signs', ARRAY['thoughts of self harm', 'suicidal thoughts', 'self harm']::TEXT[], true),
    ('4d05ee06-9737-4e08-a9bb-66a227b75451', 'loss-of-consciousness', 'Loss of consciousness', 'Emergency Warning Signs', ARRAY['loss of consciousness', 'passed out', 'fainted and did not wake']::TEXT[], true),
    ('b24aeab9-cf1f-4827-a2cf-04025ee2c8d2', 'seizure', 'Seizure', 'Emergency Warning Signs', ARRAY['seizure', 'convulsion', 'fit']::TEXT[], true),
    ('487f5490-72d4-41a9-8edb-b5979b49df25', 'swelling-of-face-or-throat', 'Swelling of the face or throat', 'Emergency Warning Signs', ARRAY['swelling of the face', 'throat swelling', 'face swelling']::TEXT[], true);

-- Symptom -> specialization weights, resolved by specialization slug so
-- this migration does not need to hardcode specialization UUIDs.
INSERT INTO "symptom_specializations" ("symptom_id", "specialization_id", "weight")
SELECT '4e92b1ab-3ba1-4f4b-9dfc-8955de937a0d'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '4e92b1ab-3ba1-4f4b-9dfc-8955de937a0d'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '5d8c1288-83bf-4896-8de9-542db3226db8'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '5d8c1288-83bf-4896-8de9-542db3226db8'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT '7f5cd14d-35ae-442b-8b53-d58e9f6cecfd'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT 'ecfa071c-724f-47ec-9277-c57c0a71dce7'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT 'ecfa071c-724f-47ec-9277-c57c0a71dce7'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT 'f6d13bda-51ff-4e67-9f27-f3d457b41a51'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT 'd0820443-5e1a-4de9-aebd-2542142c93df'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'pulmonology'
UNION ALL
SELECT 'd0820443-5e1a-4de9-aebd-2542142c93df'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT 'f2ad23ae-1d88-47de-8ee1-1e5c2adf6e56'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'pulmonology'
UNION ALL
SELECT 'f2ad23ae-1d88-47de-8ee1-1e5c2adf6e56'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT '8fc838f1-b5f8-415f-a666-1ca1d8868302'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'pulmonology'
UNION ALL
SELECT '2fcd2bef-c5ad-4539-96c4-3784f28c83b8'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'pulmonology'
UNION ALL
SELECT '2fcd2bef-c5ad-4539-96c4-3784f28c83b8'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '545f2383-a367-4464-8166-cb9ba1eee014'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT '11fd418f-39a9-4855-9fe3-fdc23d5d53ae'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT 'f8f46428-7c8e-43e5-862d-322bddd3bea4'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT 'f8f46428-7c8e-43e5-862d-322bddd3bea4'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT 'e11a3a82-c0b4-47ae-a289-fabb83d13481'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT 'e11a3a82-c0b4-47ae-a289-fabb83d13481'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '88f62376-be2f-4fda-881d-1c56e057d6fc'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'gastroenterology'
UNION ALL
SELECT '226efaad-93f5-4e64-992f-3e134c4e4d2e'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'gastroenterology'
UNION ALL
SELECT '226efaad-93f5-4e64-992f-3e134c4e4d2e'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '24e6729d-d242-45c2-8833-ffca7a47ffc8'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'gastroenterology'
UNION ALL
SELECT '6bf550b9-bea1-4e3e-b04b-18fe225a66ba'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'gastroenterology'
UNION ALL
SELECT '48217010-7459-4488-89a9-2899f2880bd9'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'dermatology'
UNION ALL
SELECT 'f0cc2fe2-a160-4466-9e1d-9cd571569649'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'dermatology'
UNION ALL
SELECT '80ddd1b6-e92f-443d-87c6-fdaec8c83034'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'dermatology'
UNION ALL
SELECT '80ddd1b6-e92f-443d-87c6-fdaec8c83034'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'endocrinology'
UNION ALL
SELECT '2ec829b3-2157-4a0a-b2ff-3a96173fe7f4'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'dermatology'
UNION ALL
SELECT 'a58de7f1-c74c-4b2d-98bc-51e35736ebb2'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'psychiatry'
UNION ALL
SELECT '5e12e01e-47f6-475a-902c-01478056415a'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'psychiatry'
UNION ALL
SELECT 'd751879a-5af4-4848-9e41-ac17b05f8f7f'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'psychiatry'
UNION ALL
SELECT 'd751879a-5af4-4848-9e41-ac17b05f8f7f'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '757d26da-9c0d-449a-8996-235710d4e30b'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'psychiatry'
UNION ALL
SELECT '9392d248-f40b-4a27-8f0c-b60e9bb2710a'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'orthopedics'
UNION ALL
SELECT '1dc009b4-9ff6-45a9-9ab8-e70884c223b1'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'orthopedics'
UNION ALL
SELECT 'befe3782-e6cd-48f0-b006-d8766a3a60e3'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'orthopedics'
UNION ALL
SELECT '129d7488-88e5-4916-9352-7c424f5130ad'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'orthopedics'
UNION ALL
SELECT '129d7488-88e5-4916-9352-7c424f5130ad'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '3eda7944-d2b2-4658-844b-299ad4b41519'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'ent'
UNION ALL
SELECT '3eda7944-d2b2-4658-844b-299ad4b41519'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '470c15ec-e0d8-4c3d-ae84-d65582604b99'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'ent'
UNION ALL
SELECT '6673555a-2977-4c32-aa4f-f3c5401fc045'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'ent'
UNION ALL
SELECT '6673555a-2977-4c32-aa4f-f3c5401fc045'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '2fda891f-fdfd-4e93-b909-a390248d37d7'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'ent'
UNION ALL
SELECT '2e38ae9c-c39a-4735-9e75-233989a99cab'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'endocrinology'
UNION ALL
SELECT '5943ce63-2ef0-47d6-8b0e-b43869798338'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'endocrinology'
UNION ALL
SELECT '5943ce63-2ef0-47d6-8b0e-b43869798338'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT '995bab26-ed39-401f-9eee-b156efadf4eb'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'endocrinology'
UNION ALL
SELECT '81698484-cfd6-4e81-8942-ec22791b821d'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'endocrinology'
UNION ALL
SELECT '81698484-cfd6-4e81-8942-ec22791b821d'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT '76692741-ac51-4163-8e47-7a296f039e75'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'obstetrics-gynecology'
UNION ALL
SELECT '39c9b460-a018-4d61-8bb7-e7b623786be3'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'obstetrics-gynecology'
UNION ALL
SELECT '3ac9dd9e-72f7-4797-a39a-43204a961d3d'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'obstetrics-gynecology'
UNION ALL
SELECT 'a964c140-34c6-41d6-99b7-b50ebf37271b'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'obstetrics-gynecology'
UNION ALL
SELECT 'a964c140-34c6-41d6-99b7-b50ebf37271b'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT '1713e7ad-6d50-497f-80ca-8bff84199874'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '1713e7ad-6d50-497f-80ca-8bff84199874'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT '02c51a51-d508-4641-97ad-390b09db3230'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '996f5b00-a0bb-45a1-be9d-fbf0f861442f'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'pediatrics'
UNION ALL
SELECT '13fd13ca-4398-4ed8-8919-aa4070808528'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'internal-medicine'
UNION ALL
SELECT '13fd13ca-4398-4ed8-8919-aa4070808528'::UUID, sp.id, 1 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT '8a96a269-8ce6-4c4a-b403-7f08b88e856d'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'pulmonology'
UNION ALL
SELECT '8a96a269-8ce6-4c4a-b403-7f08b88e856d'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT '868501a6-2444-4edf-9048-94053f865693'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'general-practice'
UNION ALL
SELECT 'f5cbe0b3-3fb2-4acb-b3cb-07ceea10a096'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '4b649cc3-a740-486e-a90b-8c275d91fb49'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '5009e301-8c2e-40ad-a353-07f9c8a3eefc'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'psychiatry'
UNION ALL
SELECT '4d05ee06-9737-4e08-a9bb-66a227b75451'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '4d05ee06-9737-4e08-a9bb-66a227b75451'::UUID, sp.id, 2 FROM "specializations" sp WHERE sp.slug = 'cardiology'
UNION ALL
SELECT 'b24aeab9-cf1f-4827-a2cf-04025ee2c8d2'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'neurology'
UNION ALL
SELECT '487f5490-72d4-41a9-8edb-b5979b49df25'::UUID, sp.id, 3 FROM "specializations" sp WHERE sp.slug = 'ent';

