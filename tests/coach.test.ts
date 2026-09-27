import { describe, expect, it } from "vitest";
import {
  COACH_LIMITS,
  ageRange,
  allergyWarning,
  buildCoachContext,
  calorieFloorFor,
  coachSystemInstruction,
  trimReply,
} from "@/lib/coach";
import { calculateNutritionPlan } from "@/lib/nutrition";

const profile = {
  age: 34,
  weightKg: 72,
  heightCm: 168,
  gender: "female" as const,
  activityLevel: "very_active" as const,
  goal: "lose" as const,
  dietType: "jain" as const,
  allergies: ["peanut-free" as const, "dairy-free" as const],
  otherAllergies: ["kiwi"],
};
const targets = calculateNutritionPlan(profile);
const week = [
  { dayLabel: "Mon", meal: "breakfast" as const, title: "Moong Dal Chilla" },
  { dayLabel: "Mon", meal: "lunch" as const, title: "Dal Rice" },
];

describe("buildCoachContext (what Gemini sees)", () => {
  const context = buildCoachContext(profile, targets, week, "Mon");

  it("includes what the coach needs", () => {
    expect(context).toContain("Age range: 30–39");
    expect(context).toContain("Goal: lose weight");
    expect(context).toContain("Activity level: very active");
    expect(context).toContain(`Daily targets: ${targets.calories} kcal`);
    expect(context).toContain("Diet: Jain");
    expect(context).toContain("Allergies (must avoid completely): Peanuts, Dairy / milk, kiwi");
    expect(context).toContain("- Mon breakfast: Moong Dal Chilla");
  });

  it("never includes exact age, weight or height", () => {
    expect(context).not.toMatch(/\b34\b/);
    expect(context).not.toMatch(/\b72\b/);
    expect(context).not.toMatch(/\b168\b/);
  });

  it("says when nothing is planned", () => {
    expect(buildCoachContext({ ...profile, allergies: [], otherAllergies: [] }, targets, [], "Tue")).toContain(
      "Allergies (must avoid completely): none",
    );
    expect(buildCoachContext(profile, targets, [], "Tue")).toContain("- (none planned yet)");
  });
});

describe("coachSystemInstruction", () => {
  const system = coachSystemInstruction("CONTEXT", "jain", calorieFloorFor("female"));
  it("contains the safety rules", () => {
    expect(system).toContain("CONTEXT");
    expect(system).toContain("never suggest any food that contains the user's allergens or breaks their diet (Jain)");
    expect(system).toContain("less than 1200 kcal");
    expect(system).toContain("call 112");
    expect(system).toContain("Tele-MANAS (14416)");
    expect(system).toContain("not a doctor");
  });
});

describe("allergyWarning (server check on every reply)", () => {
  it("adds a warning when a reply mentions the user's allergens", () => {
    expect(allergyWarning("Try peanut chutney with your dosa!", ["peanut-free"], [])).toContain("Peanuts");
    expect(allergyWarning("A glass of milk has 8 g protein.", ["dairy-free"], [])).toContain("Dairy / milk");
    expect(allergyWarning("Add sliced kiwis for vitamin C.", [], ["kiwi"])).toContain("kiwi");
  });

  it("stays quiet when the reply is safe", () => {
    expect(allergyWarning("Moong dal chilla is a good high-protein breakfast.", ["peanut-free", "dairy-free"], ["kiwi"])).toBeNull();
    expect(allergyWarning("Coconut milk works well in curries.", ["dairy-free"], [])).toBeNull();
  });
});

describe("small helpers", () => {
  it("ageRange", () => {
    expect(ageRange(17)).toBe("16–19");
    expect(ageRange(20)).toBe("20–29");
    expect(ageRange(59)).toBe("50–59");
  });

  it("trimReply keeps short replies and cuts long ones at a word", () => {
    expect(trimReply("  hello  ")).toBe("hello");
    const long = "word ".repeat(1000);
    const trimmed = trimReply(long);
    expect(trimmed.length).toBeLessThanOrEqual(COACH_LIMITS.maxReplyChars);
    expect(trimmed.endsWith("word…")).toBe(true);
  });
});
