import { describe, expect, it } from "vitest";
import { profileFromRow, profileToRow } from "@/lib/profile";
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
    });
    expect(profileFromRow(row)).toEqual(profile);
  });

  it("accepts numeric columns returned as strings", () => {
    const row = { ...profileToRow("u", profile), weight_kg: "80.5", height_cm: "180.0" };
    expect(profileFromRow(row)?.weightKg).toBe(80.5);
    expect(profileFromRow(row)?.heightCm).toBe(180);
  });

  it("returns null for a row that no longer validates", () => {
    const row = { ...profileToRow("u", profile), allergies: ["removed-option"] };
    expect(profileFromRow(row)).toBeNull();
  });
});
