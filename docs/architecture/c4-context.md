# C4 L1 — System Context

```mermaid
C4Context
  title System Context — Telehealth

  Person(patient, "Patient", "Finds a doctor, books and joins consultations")
  Person(doctor, "Doctor", "Manages availability, holds consultations, writes notes")
  Person(admin, "Administrator", "Pre-provisioned account; oversees users and appointments")

  System_Boundary(boundary, "Telehealth (runtime-owned containers only)") {
    System(telehealth, "Telehealth", "Product website, Patient, Doctor, and Admin experiences")
  }

  Rel(patient, telehealth, "Uses", "HTTPS")
  Rel(doctor, telehealth, "Uses", "HTTPS")
  Rel(admin, telehealth, "Uses", "HTTPS")
```

No third-party system appears in this diagram: authentication, doctor matching, notifications,
scheduling, consultations, and medical records are all implemented inside the Telehealth system
boundary itself (see [Deployment](/architecture/deployment) and `CLAUDE.md`'s standalone-runtime
rule).
