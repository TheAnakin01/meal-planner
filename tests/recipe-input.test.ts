import { describe, expect, it } from "vitest";
import { type RecipeLine, analyzeRecipe, kcalMismatch } from "@/lib/recipe-analysis";
import { type RecipeInput, publishProblems, recipeInputSchema, toSaveRecipeArgs } from "@/lib/recipe-input";

const input: RecipeInput = {
  id: null,
  title: "Paneer Bhurji",
  description: "Scrambled paneer with spices",
  cuisine: "Indian",
  mealTypes: ["breakfast", "dinner"],
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 10,
  steps: ["Crumble paneer", "Cook with spices"],
  imageUrl: "",
  lines: [
    { ingredientId: 3, grams: 200, displayAmount: "200 g", note: "" },
    { ingredientId: 2, grams: 10, displayAmount: "2 tsp", note: "" },
  ],
};

const paneer = {
  name: "paneer",
  aliases: [],
  per100g: { kcal: 273, proteinG: 18, carbsG: 3, fatG: 21, fiberG: 0 },
  allergenTags: ["dairy-free" as const],
  containsMeat: false,
  containsFish: false,
  containsEgg: false,
  containsDairy: true,
  containsHoney: false,
  jainAvoid: false,
};
const ghee = { ...paneer, name: "ghee", per100g: { kcal: 876, proteinG: 0, carbsG: 0, fatG: 99.5, fiberG: 0 } };
const lines: RecipeLine[] = [
  { grams: 200, ingredient: paneer },
  { grams: 10, ingredient: ghee },
];

const firstIssue = (value: unknown) => {
  const r = recipeInputSchema.safeParse(value);
  return r.success ? null : r.error.issues[0].message;
};

describe("recipeInputSchema", () => {
  it("accepts a complete recipe", () => {
    expect(firstIssue(input)).toBeNull();
  });

  it("explains what is missing", () => {
    expect(firstIssue({ ...input, title: "  " })).toBe("Please enter a title.");
    expect(firstIssue({ ...input, mealTypes: [] })).toBe("Pick at least one meal.");
    expect(firstIssue({ ...input, lines: [] })).toBe("Add at least one ingredient.");
    expect(firstIssue({ ...input, lines: [{ ...input.lines[0], grams: NaN }] })).toBe("Enter grams for every ingredient.");
    expect(firstIssue({ ...input, imageUrl: "http://insecure.example/x.jpg" })).toBe("Image links must start with https://");
  });
});

describe("toSaveRecipeArgs", () => {
  it("uses nutrition, allergens and diets computed on the server, not from the browser", () => {
    const analysis = analyzeRecipe(input.title, input.servings, lines);
    const { p_recipe, p_lines } = toSaveRecipeArgs(input, analysis);
    // (200 g × 273 + 10 g × 876) / 100 / 2 servings = 316.8 kcal
    expect(p_recipe.kcal_per_serving).toBe(316.8);
    expect(p_recipe.allergen_tags).toEqual(["dairy-free"]);
    expect(p_recipe.diet_types).toEqual(["veg", "eggetarian", "jain", "nonveg"]);
    expect(p_recipe.cuisine).toBe("indian");
    expect(p_lines).toEqual([
      { ingredient_id: 3, grams: 200, display_amount: "200 g", note: "" },
      { ingredient_id: 2, grams: 10, display_amount: "2 tsp", note: "" },
    ]);
  });

  it("sends null nutrition when it can't be calculated", () => {
    const analysis = analyzeRecipe("x", 2, [{ grams: 100, ingredient: { ...paneer, per100g: null } }]);
    expect(toSaveRecipeArgs(input, analysis).p_recipe.kcal_per_serving).toBeNull();
  });
});

describe("publishProblems", () => {
  it("is empty for a complete recipe", () => {
    expect(publishProblems(input, analyzeRecipe(input.title, 2, lines))).toEqual([]);
  });

  it("lists everything that blocks publishing", () => {
    const analysis = analyzeRecipe("x", 2, [{ grams: 100, ingredient: { ...paneer, name: "curry leaves", per100g: null } }]);
    expect(publishProblems({ steps: [], lines: [1] }, analysis)).toEqual([
      "Add at least one cooking step.",
      "These ingredients have no nutrition yet: curry leaves.",
    ]);
  });
});

describe("kcalMismatch", () => {
  it("flags calories that don't match the macros (the paneer typo)", () => {
    expect(kcalMismatch({ kcal: 299, proteinG: 18.3, carbsG: 3, fatG: 21, fiberG: 0 })).toBe(274);
  });

  it("accepts values within 15%", () => {
    expect(kcalMismatch({ kcal: 273, proteinG: 18, carbsG: 3, fatG: 21, fiberG: 0 })).toBeNull();
    expect(kcalMismatch({ kcal: 876, proteinG: 0, carbsG: 0, fatG: 99.5, fiberG: 0 })).toBeNull();
  });

  it("counts fibre at ~2 kcal/g, so high-fibre dals aren't falsely flagged", () => {
    // USDA moong dal (raw): 347 kcal, P 23.9, C 62.6 (incl. 16.3 fibre), F 1.2
    expect(kcalMismatch({ kcal: 347, proteinG: 23.9, carbsG: 62.6, fatG: 1.2, fiberG: 16.3 })).toBeNull();
  });

  it("ignores near-zero foods like spices and water", () => {
    expect(kcalMismatch({ kcal: 5, proteinG: 0.5, carbsG: 1, fatG: 0.1, fiberG: 0 })).toBeNull();
  });
});
