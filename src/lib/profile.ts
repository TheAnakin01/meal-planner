// Converts between the app's profile shape (camelCase) and the database row (snake_case).
// See supabase/migrations/0001_init.sql for the table definition.

import { type ProfileInput, profileSchema } from "@/lib/validation";

export interface ProfileRow {
  id: string;
  age: number;
  weight_kg: number | string;
  height_cm: number | string;
  gender: string;
  activity_level: string;
  goal: string;
  allergies: string[];
  other_allergies: string[];
  updated_at?: string;
}

export const PROFILE_COLUMNS =
  "id, age, weight_kg, height_cm, gender, activity_level, goal, allergies, other_allergies";

export function profileToRow(userId: string, profile: ProfileInput): Omit<ProfileRow, "updated_at"> {
  return {
    id: userId,
    age: profile.age,
    weight_kg: profile.weightKg,
    height_cm: profile.heightCm,
    gender: profile.gender,
    activity_level: profile.activityLevel,
    goal: profile.goal,
    allergies: profile.allergies,
    other_allergies: profile.otherAllergies,
  };
}

// Returns null if the stored row no longer passes validation (e.g. an allergy option was removed).
export function profileFromRow(row: ProfileRow): ProfileInput | null {
  const parsed = profileSchema.safeParse({
    age: row.age,
    weightKg: Number(row.weight_kg),
    heightCm: Number(row.height_cm),
    gender: row.gender,
    activityLevel: row.activity_level,
    goal: row.goal,
    allergies: row.allergies,
    otherAllergies: row.other_allergies,
  });
  return parsed.success ? parsed.data : null;
}
