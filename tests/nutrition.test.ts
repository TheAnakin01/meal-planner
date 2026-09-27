import { describe, expect, it } from "vitest";
import {
  type BodyProfile,
  calculateBmr,
  calculateDailyCalories,
  calculateMacros,
  calculateMealTargets,
  calculateNutritionPlan,
  calculateTdee,
  feetInchesToCm,
  poundsToKg,
} from "@/lib/nutrition";

const man: BodyProfile = {
  age: 30,
  weightKg: 80,
  heightCm: 180,
  gender: "male",
  activityLevel: "moderate",
  goal: "maintain",
};

describe("calculateBmr (Mifflin–St Jeor)", () => {
  it("uses +5 for male", () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(calculateBmr(man)).toBe(1780);
  });

  it("uses -161 for female", () => {
    const woman = { ...man, age: 25, weightKg: 60, heightCm: 165, gender: "female" as const };
    // 600 + 1031.25 - 125 - 161
    expect(calculateBmr(woman)).toBeCloseTo(1345.25);
  });

  it("uses the male/female average for other", () => {
    expect(calculateBmr({ ...man, gender: "other" })).toBe(1697);
  });
});

describe("calculateTdee", () => {
  it("multiplies BMR by the activity level", () => {
    expect(calculateTdee(man)).toBeCloseTo(1780 * 1.55);
    expect(calculateTdee({ ...man, activityLevel: "sedentary" })).toBeCloseTo(1780 * 1.2);
    expect(calculateTdee({ ...man, activityLevel: "very_active" })).toBeCloseTo(1780 * 1.9);
  });
});

describe("calculateDailyCalories", () => {
  it("adjusts for goal and rounds to the nearest 10", () => {
    // TDEE = 2759
    expect(calculateDailyCalories(man)).toBe(2760);
    expect(calculateDailyCalories({ ...man, goal: "lose" })).toBe(2260);
    expect(calculateDailyCalories({ ...man, goal: "gain" })).toBe(3060);
  });

  it("never goes below 1200 for women", () => {
    const smallWoman: BodyProfile = {
      age: 25,
      weightKg: 60,
      heightCm: 165,
      gender: "female",
      activityLevel: "sedentary",
      goal: "lose",
    };
    expect(calculateDailyCalories(smallWoman)).toBe(1200);
  });

  it("never goes below 1500 for men", () => {
    const smallMan: BodyProfile = {
      age: 60,
      weightKg: 50,
      heightCm: 150,
      gender: "male",
      activityLevel: "sedentary",
      goal: "lose",
    };
    expect(calculateDailyCalories(smallMan)).toBe(1500);
  });
});

describe("calculateMacros", () => {
  it("sets protein by body weight and fat at 25% of calories", () => {
    const macros = calculateMacros(2760, 80, "maintain");
    expect(macros.proteinG).toBe(128); // 1.6 g/kg * 80
    expect(macros.fatG).toBe(77); // 2760 * 0.25 / 9
  });

  it("caps protein at 35% of calories", () => {
    // 2.0 g/kg * 150 = 300 g would be 1200 kcal; cap is 2140 * 0.35 / 4 = 187 g
    expect(calculateMacros(2140, 150, "lose").proteinG).toBe(187);
  });

  it("macro calories add up to the daily target", () => {
    for (const goal of ["lose", "maintain", "gain"] as const) {
      const calories = calculateDailyCalories({ ...man, goal });
      const { proteinG, carbsG, fatG } = calculateMacros(calories, man.weightKg, goal);
      const total = proteinG * 4 + carbsG * 4 + fatG * 9;
      expect(Math.abs(total - calories)).toBeLessThanOrEqual(10);
      expect(carbsG).toBeGreaterThan(0);
    }
  });
});

describe("calculateMealTargets", () => {
  it("splits 25/35/40 with a ±15% range", () => {
    expect(calculateMealTargets(2000)).toEqual({
      breakfast: { calories: 500, min: 425, max: 575 },
      lunch: { calories: 700, min: 595, max: 805 },
      dinner: { calories: 800, min: 680, max: 920 },
    });
  });
});

describe("calculateNutritionPlan", () => {
  it("combines everything", () => {
    const plan = calculateNutritionPlan(man);
    expect(plan.bmr).toBe(1780);
    expect(plan.tdee).toBe(2759);
    expect(plan.calories).toBe(2760);
    expect(plan.meals.breakfast.calories).toBe(690);
  });
});

describe("unit conversions", () => {
  it("converts pounds to kg", () => {
    expect(poundsToKg(176)).toBe(79.8);
  });

  it("converts feet and inches to cm", () => {
    expect(feetInchesToCm(5, 11)).toBe(180.3);
  });
});
