import { describe, expect, it } from "vitest";
import { calculateNutritionPlan } from "@/lib/nutrition";
import {
  DAYS,
  MEALS,
  type PlanSlot,
  type PlannerProfile,
  type PlannerRecipe,
  bestPortion,
  dayTotals,
  eligibleRecipes,
  generateWeek,
  swapMeal,
  weekStart,
} from "@/lib/planner";

let nextId = 1;
function recipe(title: string, meals: PlannerRecipe["mealTypes"], kcal: number, macros: [number, number, number], extra: Partial<PlannerRecipe> = {}): PlannerRecipe {
  return {
    id: nextId++,
    title,
    cuisine: "indian",
    mealTypes: meals,
    perServing: { kcal, proteinG: macros[0], carbsG: macros[1], fatG: macros[2], fiberG: 3 },
    allergenTags: [],
    dietTypes: ["veg", "eggetarian", "jain", "vegan", "nonveg"],
    ingredientNames: [],
    ...extra,
  };
}

const VEG = ["veg", "eggetarian", "nonveg"] as PlannerRecipe["dietTypes"];
const library: PlannerRecipe[] = [
  recipe("Poha", ["breakfast"], 350, [8, 60, 9], { ingredientNames: ["flattened rice", "peanuts", "onion"], allergenTags: ["peanut-free"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Upma", ["breakfast"], 330, [9, 55, 8], { ingredientNames: ["semolina", "ghee"], allergenTags: ["wheat-free", "gluten-free", "dairy-free"], dietTypes: VEG }),
  recipe("Besan Chilla", ["breakfast"], 300, [15, 35, 10], { ingredientNames: ["besan", "oil"] }),
  recipe("Masala Omelette", ["breakfast"], 280, [18, 4, 20], { ingredientNames: ["eggs", "onion"], allergenTags: ["egg-free"], dietTypes: ["eggetarian", "nonveg"] }),
  recipe("Paneer Paratha", ["breakfast"], 450, [18, 50, 18], { ingredientNames: ["atta", "paneer", "ghee"], allergenTags: ["wheat-free", "gluten-free", "dairy-free"], dietTypes: VEG }),
  recipe("Idli Sambar", ["breakfast"], 360, [12, 65, 5], { ingredientNames: ["rice", "urad dal", "toor dal"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Dal Rice", ["lunch", "dinner"], 450, [16, 75, 8], { ingredientNames: ["toor dal", "rice", "ghee"], allergenTags: ["dairy-free"], dietTypes: ["veg", "eggetarian", "jain", "nonveg"] }),
  recipe("Rajma Chawal", ["lunch", "dinner"], 500, [18, 80, 10], { ingredientNames: ["rajma", "rice", "onion", "oil"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Chole", ["lunch", "dinner"], 480, [17, 65, 14], { ingredientNames: ["chickpeas", "onion", "oil"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Paneer Bhurji", ["lunch", "dinner"], 320, [16, 8, 25], { ingredientNames: ["paneer", "ghee", "onion"], allergenTags: ["dairy-free"], dietTypes: VEG }),
  recipe("Veg Pulao", ["lunch", "dinner"], 420, [9, 70, 11], { ingredientNames: ["rice", "peas", "oil"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Aloo Gobi Roti", ["lunch", "dinner"], 430, [11, 60, 15], { ingredientNames: ["potato", "cauliflower", "atta", "oil"], allergenTags: ["wheat-free", "gluten-free"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Kadhi Chawal", ["lunch", "dinner"], 460, [14, 70, 13], { ingredientNames: ["curd", "besan", "rice"], allergenTags: ["dairy-free"], dietTypes: VEG }),
  recipe("Palak Paneer Roti", ["lunch", "dinner"], 520, [22, 45, 27], { ingredientNames: ["spinach", "paneer", "atta"], allergenTags: ["dairy-free", "wheat-free", "gluten-free"], dietTypes: VEG }),
  recipe("Sambar Rice", ["lunch", "dinner"], 440, [13, 78, 8], { ingredientNames: ["toor dal", "rice", "drumstick"], dietTypes: ["veg", "eggetarian", "vegan", "nonveg"] }),
  recipe("Chicken Curry", ["lunch", "dinner"], 420, [35, 10, 26], { ingredientNames: ["chicken", "onion", "yogurt"], allergenTags: ["dairy-free"], dietTypes: ["nonveg"] }),
  recipe("Fish Curry", ["lunch", "dinner"], 380, [30, 12, 22], { ingredientNames: ["pomfret", "coconut milk"], allergenTags: ["fish-free"], dietTypes: ["nonveg"] }),
];
const byId = new Map(library.map((r) => [r.id, r]));

const vegNoAllergies: PlannerProfile = { allergies: [], otherAllergies: [], dietType: "veg" };
const targets = calculateNutritionPlan({
  // Female, 2,050 kcal/day: breakfast 513, lunch 718, dinner 820 — reachable with these dishes.
  age: 30, weightKg: 60, heightCm: 165, gender: "female", activityLevel: "moderate", goal: "maintain",
});

describe("eligibleRecipes", () => {
  it("applies diet type", () => {
    const titles = eligibleRecipes(library, vegNoAllergies).map((r) => r.title);
    expect(titles).not.toContain("Chicken Curry");
    expect(titles).not.toContain("Fish Curry");
    expect(titles).not.toContain("Masala Omelette");
    expect(titles).toContain("Paneer Bhurji");
  });

  it("applies allergies by tag and by 'other allergy' words", () => {
    const titles = eligibleRecipes(library, { allergies: ["dairy-free"], otherAllergies: ["peanut"], dietType: "nonveg" }).map((r) => r.title);
    expect(titles).not.toContain("Paneer Bhurji");
    expect(titles).not.toContain("Poha"); // peanuts
    expect(titles).toContain("Chole");
  });

  it("re-checks words even when a stored tag is missing", () => {
    const untagged = recipe("Butter Toast", ["breakfast"], 300, [8, 40, 12], { ingredientNames: ["bread", "butter"] });
    expect(eligibleRecipes([untagged], { allergies: ["dairy-free"], otherAllergies: [], dietType: "nonveg" })).toEqual([]);
  });

  it("re-checks diet words even when stored diet types are wrong", () => {
    const mislabelled = recipe("Keema Pav", ["dinner"], 500, [25, 40, 25], { ingredientNames: ["mutton keema", "pav"], dietTypes: ["veg", "nonveg"] });
    expect(eligibleRecipes([mislabelled], vegNoAllergies)).toEqual([]);
  });
});

describe("bestPortion", () => {
  it("scales in 0.25 steps to get closest to the target", () => {
    expect(bestPortion(400, 690)).toMatchObject({ portion: 1.75, kcal: 700, withinTolerance: true });
    expect(bestPortion(450, 450)).toMatchObject({ portion: 1, withinTolerance: true });
  });

  it("never goes outside 0.5×–2×, and says when the fit is poor", () => {
    expect(bestPortion(400, 100)).toMatchObject({ portion: 0.5, withinTolerance: false });
    expect(bestPortion(200, 1000)).toMatchObject({ portion: 2, withinTolerance: false });
  });
});

describe("generateWeek", () => {
  const plan = generateWeek(library, vegNoAllergies, targets, { seed: 42, leftovers: false });

  it("fills all 21 meals with recipes this person can eat", () => {
    expect(plan.slots).toHaveLength(DAYS * MEALS.length);
    expect(plan.gaps).toEqual([]);
    const allowed = new Set(eligibleRecipes(library, vegNoAllergies).map((r) => r.id));
    for (const s of plan.slots) {
      expect(allowed.has(s.recipeId)).toBe(true);
      expect(byId.get(s.recipeId)!.mealTypes).toContain(s.meal);
    }
  });

  it("scales portions so meals land near their calorie targets", () => {
    for (const s of plan.slots) {
      const kcal = byId.get(s.recipeId)!.perServing.kcal * s.portion;
      const target = targets.meals[s.meal].calories;
      expect(Math.abs(kcal - target) / target).toBeLessThanOrEqual(0.1);
    }
  });

  it("keeps variety: at most twice a week, never on consecutive days", () => {
    for (const id of new Set(plan.slots.map((s) => s.recipeId))) {
      const days = plan.slots.filter((s) => s.recipeId === id).map((s) => s.day).sort();
      expect(days.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBeGreaterThan(1);
    }
    expect(plan.notes).toEqual([]);
  });

  it("is repeatable for the same seed and changes with a new seed", () => {
    expect(generateWeek(library, vegNoAllergies, targets, { seed: 42, leftovers: false })).toEqual(plan);
    const other = generateWeek(library, vegNoAllergies, targets, { seed: 7, leftovers: false });
    expect(other.slots.map((s) => s.recipeId)).not.toEqual(plan.slots.map((s) => s.recipeId));
  });

  it("keeps locked meals exactly", () => {
    const lock: PlanSlot = { day: 2, meal: "dinner", recipeId: library.find((r) => r.title === "Chole")!.id, portion: 1.5, locked: true, isLeftover: false };
    const locked = generateWeek(library, vegNoAllergies, targets, { seed: 42, leftovers: false, keep: [lock] });
    expect(locked.slots.find((s) => s.day === 2 && s.meal === "dinner")).toEqual(lock);
  });

  it("leftovers mode turns yesterday's dinner into today's lunch", () => {
    const withLeftovers = generateWeek(library, vegNoAllergies, targets, { seed: 42, leftovers: true });
    for (let day = 1; day < DAYS; day++) {
      const lunch = withLeftovers.slots.find((s) => s.day === day && s.meal === "lunch")!;
      const dinner = withLeftovers.slots.find((s) => s.day === day - 1 && s.meal === "dinner")!;
      expect(lunch.isLeftover).toBe(true);
      expect(lunch.recipeId).toBe(dinner.recipeId);
    }
  });

  it("relaxes variety with a note when the library is small", () => {
    const tiny = [library.find((r) => r.title === "Besan Chilla")!, library.find((r) => r.title === "Dal Rice")!];
    const result = generateWeek(tiny, vegNoAllergies, targets, { seed: 1, leftovers: false });
    expect(result.slots).toHaveLength(21);
    expect(result.notes).toContain("Some recipes repeat more than usual because only a few recipes suit you yet.");
  });

  it("reports gaps instead of ever showing an unsafe meal", () => {
    const onlyChicken = [library.find((r) => r.title === "Chicken Curry")!];
    const result = generateWeek(onlyChicken, vegNoAllergies, targets, { seed: 1, leftovers: false });
    expect(result.slots).toEqual([]);
    expect(result.gaps).toHaveLength(21);
    expect(result.notes).toEqual(["No recipes in the library suit your diet and allergies yet."]);
  });

  it("says which meal has no recipes", () => {
    const noBreakfast = library.filter((r) => !r.mealTypes.includes("breakfast"));
    const result = generateWeek(noBreakfast, vegNoAllergies, targets, { seed: 1, leftovers: false });
    expect(result.gaps.filter((g) => g.meal === "breakfast")).toHaveLength(7);
    expect(result.notes).toContain("No breakfast recipes suit you yet.");
  });
});

describe("swapMeal", () => {
  it("replaces one meal with a different safe recipe and keeps the rest", () => {
    const plan = generateWeek(library, vegNoAllergies, targets, { seed: 42, leftovers: false });
    const before = plan.slots.find((s) => s.day === 3 && s.meal === "lunch")!;
    const swapped = swapMeal(library, vegNoAllergies, targets, plan.slots, 3, "lunch", 99)!;
    const after = swapped.find((s) => s.day === 3 && s.meal === "lunch")!;
    expect(after.recipeId).not.toBe(before.recipeId);
    expect(swapped).toHaveLength(21);
    expect(swapped.filter((s) => !(s.day === 3 && s.meal === "lunch"))).toEqual(plan.slots.filter((s) => s !== before));
  });

  it("returns null when there is no alternative", () => {
    const one = [library.find((r) => r.title === "Dal Rice")!];
    const slots: PlanSlot[] = [{ day: 0, meal: "lunch", recipeId: one[0].id, portion: 1, locked: false, isLeftover: false }];
    expect(swapMeal(one, vegNoAllergies, targets, slots, 0, "lunch", 1)).toBeNull();
  });
});

describe("dayTotals", () => {
  it("adds scaled meals for one day", () => {
    const dal = library.find((r) => r.title === "Dal Rice")!;
    const chilla = library.find((r) => r.title === "Besan Chilla")!;
    const slots: PlanSlot[] = [
      { day: 0, meal: "breakfast", recipeId: chilla.id, portion: 2, locked: false, isLeftover: false },
      { day: 0, meal: "lunch", recipeId: dal.id, portion: 1.5, locked: false, isLeftover: false },
      { day: 1, meal: "lunch", recipeId: dal.id, portion: 1, locked: false, isLeftover: false },
    ];
    expect(dayTotals(slots, 0, byId)).toEqual({ kcal: 1275, proteinG: 54, carbsG: 182.5, fatG: 32, fiberG: 10.5 });
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week in the person's timezone", () => {
    // Sunday 27 Sep 2026, midday UTC → week of Monday 21 Sep.
    expect(weekStart(new Date("2026-09-27T12:00:00Z"), "Asia/Kolkata")).toBe("2026-09-21");
    // 20:00 UTC Sunday is already 01:30 Monday in India → new week.
    expect(weekStart(new Date("2026-09-27T20:00:00Z"), "Asia/Kolkata")).toBe("2026-09-28");
    // …but still Sunday in New York.
    expect(weekStart(new Date("2026-09-27T20:00:00Z"), "America/New_York")).toBe("2026-09-21");
  });
});
