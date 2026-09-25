// Reference data: the guided-matching symptom catalog. Mirrors the seed
// rows inserted by the `20260925103000_add_symptom_catalog` migration
// exactly (same slugs, keywords, categories, red-flag markers, and
// specialization weights) so this pure structure can be unit-tested
// without a database. The migration is the actual source of truth at
// runtime; keep the two in sync by hand when either changes.

export interface SymptomSeedLink {
  specializationSlug: string;
  weight: number;
}

export interface SymptomSeedEntry {
  slug: string;
  name: string;
  category: string;
  keywords: string[];
  isRedFlag: boolean;
  links: SymptomSeedLink[];
}

export const SYMPTOM_CATALOG_SEED_DATA: SymptomSeedEntry[] = [
  { slug: "headache", name: "Headache", category: "Head & Neurological", keywords: ["headache", "migraine"], isRedFlag: false, links: [{ specializationSlug: "neurology", weight: 3 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "dizziness", name: "Dizziness", category: "Head & Neurological", keywords: ["dizziness", "dizzy", "lightheaded"], isRedFlag: false, links: [{ specializationSlug: "neurology", weight: 2 }, { specializationSlug: "cardiology", weight: 1 }] },
  { slug: "numbness-or-tingling", name: "Numbness or tingling", category: "Head & Neurological", keywords: ["numbness", "tingling", "pins and needles"], isRedFlag: false, links: [{ specializationSlug: "neurology", weight: 3 }] },
  { slug: "memory-problems", name: "Memory problems", category: "Head & Neurological", keywords: ["memory problems", "forgetfulness", "confusion"], isRedFlag: false, links: [{ specializationSlug: "neurology", weight: 2 }, { specializationSlug: "internal-medicine", weight: 1 }] },
  { slug: "tremor", name: "Tremor", category: "Head & Neurological", keywords: ["tremor", "shaking hands"], isRedFlag: false, links: [{ specializationSlug: "neurology", weight: 2 }] },
  { slug: "cough", name: "Cough", category: "Respiratory", keywords: ["cough", "coughing"], isRedFlag: false, links: [{ specializationSlug: "pulmonology", weight: 2 }, { specializationSlug: "general-practice", weight: 2 }] },
  { slug: "shortness-of-breath", name: "Shortness of breath", category: "Respiratory", keywords: ["shortness of breath", "breathless", "winded"], isRedFlag: false, links: [{ specializationSlug: "pulmonology", weight: 3 }, { specializationSlug: "cardiology", weight: 1 }] },
  { slug: "wheezing", name: "Wheezing", category: "Respiratory", keywords: ["wheezing", "wheeze"], isRedFlag: false, links: [{ specializationSlug: "pulmonology", weight: 3 }] },
  { slug: "chest-congestion", name: "Chest congestion", category: "Respiratory", keywords: ["chest congestion", "congested chest"], isRedFlag: false, links: [{ specializationSlug: "pulmonology", weight: 2 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "chest-pain", name: "Chest pain", category: "Heart & Circulation", keywords: ["chest pain", "chest tightness"], isRedFlag: true, links: [{ specializationSlug: "cardiology", weight: 3 }] },
  { slug: "palpitations", name: "Palpitations", category: "Heart & Circulation", keywords: ["palpitations", "racing heart", "heart pounding"], isRedFlag: false, links: [{ specializationSlug: "cardiology", weight: 3 }] },
  { slug: "swelling-in-legs-or-ankles", name: "Swelling in legs or ankles", category: "Heart & Circulation", keywords: ["swollen legs", "ankle swelling", "leg swelling"], isRedFlag: false, links: [{ specializationSlug: "cardiology", weight: 2 }, { specializationSlug: "internal-medicine", weight: 1 }] },
  { slug: "fainting-or-lightheadedness", name: "Fainting or lightheadedness", category: "Heart & Circulation", keywords: ["fainting", "near fainting", "feeling faint"], isRedFlag: false, links: [{ specializationSlug: "cardiology", weight: 2 }, { specializationSlug: "neurology", weight: 1 }] },
  { slug: "abdominal-pain", name: "Abdominal pain", category: "Digestive", keywords: ["abdominal pain", "stomach ache", "stomach pain"], isRedFlag: false, links: [{ specializationSlug: "gastroenterology", weight: 3 }] },
  { slug: "nausea-and-vomiting", name: "Nausea and vomiting", category: "Digestive", keywords: ["nausea", "vomiting", "throwing up"], isRedFlag: false, links: [{ specializationSlug: "gastroenterology", weight: 2 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "diarrhea", name: "Diarrhea", category: "Digestive", keywords: ["diarrhea", "loose stools"], isRedFlag: false, links: [{ specializationSlug: "gastroenterology", weight: 2 }] },
  { slug: "heartburn", name: "Heartburn", category: "Digestive", keywords: ["heartburn", "acid reflux", "indigestion"], isRedFlag: false, links: [{ specializationSlug: "gastroenterology", weight: 2 }] },
  { slug: "skin-rash", name: "Skin rash", category: "Skin", keywords: ["rash", "hives", "itchy skin"], isRedFlag: false, links: [{ specializationSlug: "dermatology", weight: 3 }] },
  { slug: "acne", name: "Acne", category: "Skin", keywords: ["acne", "pimples", "breakouts"], isRedFlag: false, links: [{ specializationSlug: "dermatology", weight: 2 }] },
  { slug: "hair-loss", name: "Hair loss", category: "Skin", keywords: ["hair loss", "thinning hair", "balding"], isRedFlag: false, links: [{ specializationSlug: "dermatology", weight: 2 }, { specializationSlug: "endocrinology", weight: 1 }] },
  { slug: "mole-changes", name: "Mole changes", category: "Skin", keywords: ["mole changes", "changing mole", "new mole"], isRedFlag: false, links: [{ specializationSlug: "dermatology", weight: 3 }] },
  { slug: "anxiety", name: "Anxiety", category: "Mental Health", keywords: ["anxiety", "anxious", "panic"], isRedFlag: false, links: [{ specializationSlug: "psychiatry", weight: 3 }] },
  { slug: "low-mood", name: "Low mood", category: "Mental Health", keywords: ["low mood", "feeling down", "sadness"], isRedFlag: false, links: [{ specializationSlug: "psychiatry", weight: 3 }] },
  { slug: "trouble-sleeping", name: "Trouble sleeping", category: "Mental Health", keywords: ["trouble sleeping", "insomnia", "cant sleep"], isRedFlag: false, links: [{ specializationSlug: "psychiatry", weight: 2 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "difficulty-concentrating", name: "Difficulty concentrating", category: "Mental Health", keywords: ["difficulty concentrating", "trouble focusing", "poor concentration"], isRedFlag: false, links: [{ specializationSlug: "psychiatry", weight: 2 }] },
  { slug: "joint-pain", name: "Joint pain", category: "Musculoskeletal", keywords: ["joint pain", "aching joints"], isRedFlag: false, links: [{ specializationSlug: "orthopedics", weight: 3 }] },
  { slug: "back-pain", name: "Back pain", category: "Musculoskeletal", keywords: ["back pain", "backache"], isRedFlag: false, links: [{ specializationSlug: "orthopedics", weight: 3 }] },
  { slug: "muscle-strain", name: "Muscle strain", category: "Musculoskeletal", keywords: ["muscle strain", "pulled muscle", "muscle pain"], isRedFlag: false, links: [{ specializationSlug: "orthopedics", weight: 2 }] },
  { slug: "neck-stiffness", name: "Neck stiffness", category: "Musculoskeletal", keywords: ["neck stiffness", "stiff neck"], isRedFlag: false, links: [{ specializationSlug: "orthopedics", weight: 2 }, { specializationSlug: "neurology", weight: 1 }] },
  { slug: "sore-throat", name: "Sore throat", category: "Ear, Nose & Throat", keywords: ["sore throat", "throat pain"], isRedFlag: false, links: [{ specializationSlug: "ent", weight: 2 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "ear-pain", name: "Ear pain", category: "Ear, Nose & Throat", keywords: ["ear pain", "earache"], isRedFlag: false, links: [{ specializationSlug: "ent", weight: 3 }] },
  { slug: "nasal-congestion", name: "Nasal congestion", category: "Ear, Nose & Throat", keywords: ["nasal congestion", "stuffy nose", "blocked nose"], isRedFlag: false, links: [{ specializationSlug: "ent", weight: 2 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "ringing-in-ears", name: "Ringing in ears", category: "Ear, Nose & Throat", keywords: ["ringing in ears", "tinnitus"], isRedFlag: false, links: [{ specializationSlug: "ent", weight: 2 }] },
  { slug: "excessive-thirst", name: "Excessive thirst", category: "Hormonal & Metabolic", keywords: ["excessive thirst", "always thirsty"], isRedFlag: false, links: [{ specializationSlug: "endocrinology", weight: 3 }] },
  { slug: "unexplained-weight-change", name: "Unexplained weight change", category: "Hormonal & Metabolic", keywords: ["unexplained weight loss", "unexplained weight gain"], isRedFlag: false, links: [{ specializationSlug: "endocrinology", weight: 2 }, { specializationSlug: "internal-medicine", weight: 2 }] },
  { slug: "heat-or-cold-intolerance", name: "Heat or cold intolerance", category: "Hormonal & Metabolic", keywords: ["heat intolerance", "cold intolerance"], isRedFlag: false, links: [{ specializationSlug: "endocrinology", weight: 2 }] },
  { slug: "increased-urination", name: "Increased urination", category: "Hormonal & Metabolic", keywords: ["frequent urination", "increased urination"], isRedFlag: false, links: [{ specializationSlug: "endocrinology", weight: 2 }, { specializationSlug: "internal-medicine", weight: 1 }] },
  { slug: "menstrual-irregularities", name: "Menstrual irregularities", category: "Women's Health", keywords: ["irregular periods", "missed period", "menstrual irregularities"], isRedFlag: false, links: [{ specializationSlug: "obstetrics-gynecology", weight: 3 }] },
  { slug: "pelvic-pain", name: "Pelvic pain", category: "Women's Health", keywords: ["pelvic pain"], isRedFlag: false, links: [{ specializationSlug: "obstetrics-gynecology", weight: 3 }] },
  { slug: "pregnancy-related-nausea", name: "Pregnancy-related nausea", category: "Women's Health", keywords: ["morning sickness", "pregnancy nausea"], isRedFlag: false, links: [{ specializationSlug: "obstetrics-gynecology", weight: 3 }] },
  { slug: "breast-lump", name: "Breast lump", category: "Women's Health", keywords: ["breast lump", "lump in breast"], isRedFlag: false, links: [{ specializationSlug: "obstetrics-gynecology", weight: 3 }, { specializationSlug: "internal-medicine", weight: 1 }] },
  { slug: "fatigue", name: "Fatigue", category: "General", keywords: ["fatigue", "tiredness", "low energy"], isRedFlag: false, links: [{ specializationSlug: "general-practice", weight: 2 }, { specializationSlug: "internal-medicine", weight: 1 }] },
  { slug: "fever", name: "Fever", category: "General", keywords: ["fever", "high temperature"], isRedFlag: false, links: [{ specializationSlug: "general-practice", weight: 3 }] },
  { slug: "growth-or-developmental-concern", name: "Growth or developmental concern", category: "General", keywords: ["growth concern", "developmental delay"], isRedFlag: false, links: [{ specializationSlug: "pediatrics", weight: 3 }] },
  { slug: "persistent-minor-illnesses", name: "Persistent minor illnesses", category: "General", keywords: ["frequent infections", "getting sick often"], isRedFlag: false, links: [{ specializationSlug: "internal-medicine", weight: 3 }, { specializationSlug: "general-practice", weight: 1 }] },
  { slug: "difficulty-breathing", name: "Difficulty breathing", category: "Emergency Warning Signs", keywords: ["difficulty breathing", "cant breathe", "struggling to breathe"], isRedFlag: true, links: [{ specializationSlug: "pulmonology", weight: 3 }, { specializationSlug: "cardiology", weight: 2 }] },
  { slug: "severe-bleeding", name: "Severe bleeding", category: "Emergency Warning Signs", keywords: ["severe bleeding", "heavy bleeding", "uncontrolled bleeding"], isRedFlag: true, links: [{ specializationSlug: "general-practice", weight: 3 }] },
  { slug: "sudden-weakness-or-numbness-one-side", name: "Sudden weakness or numbness on one side", category: "Emergency Warning Signs", keywords: ["sudden weakness one side", "sudden numbness one side", "face drooping"], isRedFlag: true, links: [{ specializationSlug: "neurology", weight: 3 }] },
  { slug: "sudden-severe-headache", name: "Sudden severe headache", category: "Emergency Warning Signs", keywords: ["sudden severe headache", "worst headache"], isRedFlag: true, links: [{ specializationSlug: "neurology", weight: 3 }] },
  { slug: "thoughts-of-self-harm", name: "Thoughts of self-harm", category: "Emergency Warning Signs", keywords: ["thoughts of self harm", "suicidal thoughts", "self harm"], isRedFlag: true, links: [{ specializationSlug: "psychiatry", weight: 3 }] },
  { slug: "loss-of-consciousness", name: "Loss of consciousness", category: "Emergency Warning Signs", keywords: ["loss of consciousness", "passed out", "fainted and did not wake"], isRedFlag: true, links: [{ specializationSlug: "neurology", weight: 2 }, { specializationSlug: "cardiology", weight: 2 }] },
  { slug: "seizure", name: "Seizure", category: "Emergency Warning Signs", keywords: ["seizure", "convulsion", "fit"], isRedFlag: true, links: [{ specializationSlug: "neurology", weight: 3 }] },
  { slug: "swelling-of-face-or-throat", name: "Swelling of the face or throat", category: "Emergency Warning Signs", keywords: ["swelling of the face", "throat swelling", "face swelling"], isRedFlag: true, links: [{ specializationSlug: "ent", weight: 3 }] },
];

