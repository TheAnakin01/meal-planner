import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIET_TYPE_IDS, type DietType } from "@/lib/diet";
import type { AllergenId } from "@/lib/allergens";
import { AISLES } from "@/lib/library";
import { calculateNutritionPlan } from "@/lib/nutrition";
import { type PlannerRecipe, generateWeek } from "@/lib/planner";
import { type RecipeLine, analyzeRecipe, kcalMismatch, looksCooked } from "@/lib/recipe-analysis";
import { recipeInputSchema } from "@/lib/recipe-input";
import { STARTER_INGREDIENTS, STARTER_RECIPES, buildStarterSeedSql } from "../supabase/seed/starter-library";

const byName = new Map(STARTER_INGREDIENTS.map((i) => [i.name, i]));

function linesOf(recipe: (typeof STARTER_RECIPES)[number]): RecipeLine[] {
  return recipe.lines.map(([name, grams]) => {
    const ingredient = byName.get(name);
    if (!ingredient) throw new Error(`${recipe.title}: unknown ingredient "${name}"`);
    return { grams, ingredient };
  });
}

const analysed = STARTER_RECIPES.map((r) => ({ recipe: r, analysis: analyzeRecipe(r.title, r.servings, linesOf(r)) }));

// The recipes as the planner will see them after the owner publishes them.
const plannerRecipes: PlannerRecipe[] = analysed.map(({ recipe, analysis }, i) => ({
  id: i + 1,
  title: recipe.title,
  cuisine: recipe.cuisine,
  mealTypes: recipe.mealTypes,
  perServing: analysis.nutrition.perServing!,
  allergenTags: analysis.allergens.tags,
  dietTypes: analysis.diets.dietTypes,
  ingredientNames: recipe.lines.flatMap(([name]) => [name, ...byName.get(name)!.aliases]),
}));

describe("starter ingredients", () => {
  it("have unique lowercase names and unique USDA ids", () => {
    const names = STARTER_INGREDIENTS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toBe(name.toLowerCase());
    const fdcIds = STARTER_INGREDIENTS.flatMap((i) => (i.fdcId === null ? [] : [i.fdcId]));
    expect(new Set(fdcIds).size).toBe(fdcIds.length);
  });

  it("use valid aisles and sensible shopping units", () => {
    const aisles = AISLES.map((a) => a.id as string);
    for (const i of STARTER_INGREDIENTS) {
      expect(aisles, i.name).toContain(i.aisle);
      expect(i.packSize, i.name).toBeGreaterThan(0);
      if (i.purchaseUnit === "piece") expect(i.gramsPerPiece, i.name).toBeGreaterThan(0);
    }
  });

  it("have raw (not cooked) nutrition whose calories roughly match the macros", () => {
    for (const i of STARTER_INGREDIENTS) {
      expect(looksCooked(i.name, i.aisle, i.per100g.kcal), i.name).toBe(false);
      // USDA's own food-specific calorie factors differ from 4/4/9 by up to ~25% (e.g. lemon, spices),
      // so the importer's 7% hint is too tight here; 30% still catches typing mistakes.
      const estimate = kcalMismatch(i.per100g);
      if (estimate !== null) {
        expect(Math.abs(i.per100g.kcal - estimate) / Math.max(i.per100g.kcal, estimate), i.name).toBeLessThan(0.3);
      }
    }
  });

  it("carry flags that agree with their allergen tags", () => {
    for (const i of STARTER_INGREDIENTS) {
      expect(i.containsDairy, i.name).toBe(i.allergenTags.includes("dairy-free"));
      expect(i.containsEgg, i.name).toBe(i.allergenTags.includes("egg-free"));
      if (i.allergenTags.includes("fish-free") || i.allergenTags.includes("crustacean-free")) {
        expect(i.containsFish, i.name).toBe(true);
      }
    }
  });
});

describe("starter recipes", () => {
  it("have unique titles and pass the editor's validation", () => {
    const titles = STARTER_RECIPES.map((r) => r.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    const ids = new Map(STARTER_INGREDIENTS.map((i, n) => [i.name, n + 1]));
    for (const r of STARTER_RECIPES) {
      const input = {
        id: null,
        title: r.title,
        description: r.description,
        cuisine: r.cuisine,
        mealTypes: r.mealTypes,
        servings: r.servings,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        steps: r.steps,
        imageUrl: "",
        lines: r.lines.map(([name, grams, display]) => ({ ingredientId: ids.get(name) ?? -1, grams, displayAmount: display, note: "" })),
      };
      const parsed = recipeInputSchema.safeParse(input);
      expect(parsed.success ? "ok" : parsed.error.issues[0].message, r.title).toBe("ok");
    }
  });

  it("get nutrition and a sensible calorie count per serving", () => {
    for (const { recipe, analysis } of analysed) {
      const kcal = analysis.nutrition.perServing?.kcal ?? 0;
      expect(kcal, recipe.title).toBeGreaterThanOrEqual(200);
      expect(kcal, recipe.title).toBeLessThanOrEqual(650);
    }
  });

  it("raise no allergen or diet warnings (tags agree with the word check)", () => {
    for (const { recipe, analysis } of analysed) {
      expect([...analysis.allergens.warnings, ...analysis.diets.warnings], recipe.title).toEqual([]);
    }
  });

  it("label diet types correctly for key dishes", () => {
    const diets = (title: string) => plannerRecipes.find((r) => r.title === title)!.dietTypes;
    expect(diets("Chicken Curry with Rice")).toEqual(["nonveg"]);
    expect(diets("Egg Curry with Rice")).toEqual(["eggetarian", "nonveg"]);
    expect(diets("Palak Paneer with Roti")).toEqual(["veg", "eggetarian", "nonveg"]);
    expect(diets("Jain Palak Paneer with Roti")).toContain("jain");
    expect(diets("Jain Palak Paneer with Roti")).not.toContain("vegan");
    expect(diets("Rajma Chawal")).toContain("vegan");
    expect(diets("Rajma Chawal")).not.toContain("jain");
    expect(diets("Lemon Rice with Peanuts")).toEqual(expect.arrayContaining(["vegan", "jain"]));
  });

  it("offer every diet type enough choice for each meal", () => {
    for (const diet of DIET_TYPE_IDS) {
      for (const meal of ["breakfast", "lunch", "dinner"] as const) {
        const count = plannerRecipes.filter((r) => r.dietTypes.includes(diet) && r.mealTypes.includes(meal)).length;
        expect(count, `${diet} ${meal}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("let the planner fill a whole week without gaps for every diet and common allergies", () => {
    const targets = calculateNutritionPlan({
      age: 30,
      weightKg: 65,
      heightCm: 165,
      gender: "female",
      activityLevel: "light",
      goal: "maintain",
    });
    const cases: [DietType, AllergenId[]][] = [
      ...DIET_TYPE_IDS.map((d): [DietType, AllergenId[]] => [d, []]),
      ["veg", ["peanut-free", "tree-nut-free"]],
      ["veg", ["gluten-free"]],
      ["nonveg", ["dairy-free"]],
      ["jain", ["peanut-free"]],
      ["vegan", ["gluten-free", "soy-free"]],
    ];
    for (const [dietType, allergies] of cases) {
      const plan = generateWeek(plannerRecipes, { dietType, allergies, otherAllergies: [] }, targets, { seed: 1, leftovers: false });
      expect(plan.gaps, `${dietType} ${allergies.join(",")}`).toEqual([]);
    }
  });

  it("never plans a recipe containing the user's allergen", () => {
    const targets = calculateNutritionPlan({ age: 40, weightKg: 80, heightCm: 175, gender: "male", activityLevel: "moderate", goal: "lose" });
    const plan = generateWeek(plannerRecipes, { dietType: "nonveg", allergies: ["dairy-free", "wheat-free"], otherAllergies: [] }, targets, {
      seed: 3,
      leftovers: false,
    });
    for (const slot of plan.slots) {
      const recipe = plannerRecipes.find((r) => r.id === slot.recipeId)!;
      expect(recipe.allergenTags, recipe.title).not.toContain("dairy-free");
      expect(recipe.allergenTags, recipe.title).not.toContain("wheat-free");
    }
  });
});

describe("starter seed SQL", () => {
  it("is up to date with the data (run `npm run seed:build` after editing)", () => {
    const file = fs.readFileSync(path.join(__dirname, "../supabase/seed/starter-library.sql"), "utf8").replace(/\r\n/g, "\n");
    expect(file).toBe(buildStarterSeedSql());
  });

  it("inserts recipes as drafts and never touches existing ingredients", () => {
    const sql = buildStarterSeedSql();
    expect(sql).toContain("'draft', 'ai'");
    expect(sql).toContain("where not exists (select 1 from public.ingredients i where i.name = x->>'name')");
    for (const i of STARTER_INGREDIENTS.filter((x) => x.existing)) {
      expect(sql).not.toContain(`"name":"${i.name}"`);
    }
  });
});
