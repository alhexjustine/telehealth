/** Whole-years age as of now, from a `YYYY-MM-DD` birth date — mirrors the API's `ageAt`. */
export function ageFromBirthDate(birthDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
