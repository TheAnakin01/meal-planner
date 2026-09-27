// Converts between the app's profile shape (camelCase) and the database row (snake_case).
// See supabase/migrations/0001_init.sql and 0003_profile_diet_store_timezone.sql.

import { type ProfileField, type ProfileInput, profileSchema } from "@/lib/validation";

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
  diet_type: string | null;
  preferred_store: string;
  timezone: string;
  updated_at?: string;
}

export const PROFILE_COLUMNS =
  "id, age, weight_kg, height_cm, gender, activity_level, goal, allergies, other_allergies, diet_type, preferred_store, timezone";

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
    diet_type: profile.dietType,
    preferred_store: profile.preferredStore,
    timezone: profile.timezone,
  };
}

function rowValues(row: ProfileRow): Record<ProfileField, unknown> {
  return {
    age: row.age,
    weightKg: Number(row.weight_kg),
    heightCm: Number(row.height_cm),
    gender: row.gender,
    activityLevel: row.activity_level,
    goal: row.goal,
    allergies: row.allergies,
    otherAllergies: row.other_allergies,
    dietType: row.diet_type ?? undefined,
    preferredStore: row.preferred_store,
    timezone: row.timezone,
  };
}

// The full profile, or null if anything is missing or no longer valid
// (e.g. a profile saved before diet type existed).
export function profileFromRow(row: ProfileRow): ProfileInput | null {
  const parsed = profileSchema.safeParse(rowValues(row));
  return parsed.success ? parsed.data : null;
}

// Every field that is still valid, for pre-filling the form when the profile is incomplete.
export function profileDraftFromRow(row: ProfileRow): Partial<ProfileInput> {
  const values = rowValues(row);
  const draft: Record<string, unknown> = {};
  for (const key of Object.keys(profileSchema.shape) as ProfileField[]) {
    const parsed = profileSchema.shape[key].safeParse(values[key]);
    if (parsed.success) draft[key] = parsed.data;
  }
  return draft as Partial<ProfileInput>;
}
