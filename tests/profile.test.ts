import { describe, expect, it } from "vitest";
import { profileDraftFromRow, profileFromRow, profileToRow } from "@/lib/profile";
import type { ProfileInput } from "@/lib/validation";

const profile: ProfileInput = {
  age: 30,
  weightKg: 80.5,
  heightCm: 180,
  gender: "female",
  activityLevel: "very_active",
  goal: "gain",
  allergies: ["peanut-free", "sesame-free"],
  otherAllergies: ["kiwi"],
  dietType: "jain",
  preferredStore: "zepto",
  timezone: "Asia/Kolkata",
};

describe("profile row mapping", () => {
  it("round-trips through the database shape", () => {
    const row = profileToRow("user-123", profile);
    expect(row).toEqual({
      id: "user-123",
      age: 30,
      weight_kg: 80.5,
      height_cm: 180,
      gender: "female",
      activity_level: "very_active",
      goal: "gain",
      allergies: ["peanut-free", "sesame-free"],
      other_allergies: ["kiwi"],
      diet_type: "jain",
      preferred_store: "zepto",
      timezone: "Asia/Kolkata",
    });
    expect(profileFromRow(row)).toEqual(profile);
  });

  it("accepts numeric columns returned as strings", () => {
    const row = { ...profileToRow("u", profile), weight_kg: "80.5", height_cm: "180.0" };
    expect(profileFromRow(row)?.weightKg).toBe(80.5);
    expect(profileFromRow(row)?.heightCm).toBe(180);
  });

  it("treats a profile saved before diet type existed as incomplete, but keeps the rest for the form", () => {
    const row = { ...profileToRow("u", profile), diet_type: null };
    expect(profileFromRow(row)).toBeNull();
    const draft = profileDraftFromRow(row);
    expect(draft.dietType).toBeUndefined();
    expect(draft).toEqual({ ...profile, dietType: undefined });
  });

  it("drops only the invalid fields from the draft", () => {
    const row = { ...profileToRow("u", profile), age: 7, allergies: ["removed-option"] };
    const draft = profileDraftFromRow(row);
    expect(draft.age).toBeUndefined();
    expect(draft.allergies).toBeUndefined();
    expect(draft.weightKg).toBe(80.5);
  });

  it("returns null for a row that no longer validates", () => {
    const row = { ...profileToRow("u", profile), allergies: ["removed-option"] };
    expect(profileFromRow(row)).toBeNull();
  });
});
