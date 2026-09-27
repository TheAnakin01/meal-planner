import { describe, expect, it } from "vitest";
import { parseOtherAllergies } from "@/lib/allergens";
import { profileSchema } from "@/lib/validation";

const valid = {
  age: 30,
  weightKg: 80,
  heightCm: 180,
  gender: "male",
  activityLevel: "moderate",
  goal: "maintain",
  allergies: ["peanut-free", "dairy-free"],
  otherAllergies: ["kiwi"],
};

const errorFields = (input: unknown) => {
  const result = profileSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
};

describe("profileSchema", () => {
  it("accepts a complete, realistic profile", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty numbers (NaN)", () => {
    expect(errorFields({ ...valid, age: NaN })).toEqual(["age"]);
  });

  it("rejects out-of-range values", () => {
    expect(errorFields({ ...valid, age: 15 })).toEqual(["age"]);
    expect(errorFields({ ...valid, age: 30.5 })).toEqual(["age"]);
    expect(errorFields({ ...valid, weightKg: 301 })).toEqual(["weightKg"]);
    expect(errorFields({ ...valid, heightCm: 100 })).toEqual(["heightCm"]);
  });

  it("requires gender, activity level and goal", () => {
    expect(
      errorFields({ ...valid, gender: undefined, activityLevel: undefined, goal: undefined }),
    ).toEqual(["gender", "activityLevel", "goal"]);
  });

  it("rejects unknown allergy labels", () => {
    expect(errorFields({ ...valid, allergies: ["chocolate-free"] })).toEqual(["allergies"]);
  });

  it("rejects other allergies with numbers or symbols", () => {
    expect(errorFields({ ...valid, otherAllergies: ["kiwi<script>"] })).toEqual(["otherAllergies"]);
  });
});

describe("parseOtherAllergies", () => {
  it("splits, trims, lowercases and removes duplicates and blanks", () => {
    expect(parseOtherAllergies(" Kiwi, strawberry ,, KIWI ")).toEqual(["kiwi", "strawberry"]);
    expect(parseOtherAllergies("")).toEqual([]);
  });
});
