import { describe, expect, it } from "vitest";
import { type IngredientRow, type RecipeRow, ingredientFromRow, recipeFromRow } from "@/lib/library";

const ingredientRow: IngredientRow = {
  id: 7,
  name: "paneer",
  aliases: ["cottage cheese"],
  fdc_id: 12345,
  kcal_per_100g: "265.00",
  protein_per_100g: "18.30",
  carbs_per_100g: "1.20",
  fat_per_100g: "20.80",
  fiber_per_100g: null,
  allergen_tags: ["dairy-free", "made-up-tag"],
  contains_meat: false,
  contains_fish: false,
  contains_egg: false,
  contains_dairy: true,
  contains_honey: false,
  jain_avoid: false,
  aisle: "dairy",
  purchase_unit: "g",
  pack_size: "200.00",
  grams_per_piece: null,
  grams_per_ml: "1.000",
  search_term: "paneer",
};

const recipeRow: RecipeRow = {
  id: 3,
  title: "Palak Paneer",
  description: "Spinach and paneer curry",
  cuisine: "indian",
  meal_types: ["lunch", "dinner", "snack"],
  servings: 4,
  prep_minutes: 15,
  cook_minutes: 25,
  steps: ["Blanch spinach", "Cook masala", "Add paneer"],
  image_url: null,
  status: "published",
  source: "ai",
  kcal_per_serving: "320.5",
  protein_per_serving: "16.0",
  carbs_per_serving: "12.0",
  fat_per_serving: "22.0",
  fiber_per_serving: "4.0",
  allergen_tags: ["dairy-free"],
  diet_types: ["veg", "eggetarian", "nonveg", "pescatarian"],
};

describe("ingredientFromRow", () => {
  it("converts numeric strings and drops unknown allergen tags", () => {
    const ing = ingredientFromRow(ingredientRow);
    expect(ing.per100g).toEqual({ kcal: 265, proteinG: 18.3, carbsG: 1.2, fatG: 20.8, fiberG: 0 });
    expect(ing.allergenTags).toEqual(["dairy-free"]);
    expect(ing.packSize).toBe(200);
    expect(ing.gramsPerPiece).toBeNull();
    expect(ing.containsDairy).toBe(true);
  });

  it("has no nutrition until it is imported", () => {
    const ing = ingredientFromRow({ ...ingredientRow, kcal_per_100g: null });
    expect(ing.per100g).toBeNull();
  });
});

describe("recipeFromRow", () => {
  it("keeps only known meal types and diet types", () => {
    const r = recipeFromRow(recipeRow);
    expect(r.mealTypes).toEqual(["lunch", "dinner"]);
    expect(r.dietTypes).toEqual(["veg", "eggetarian", "nonveg"]);
    expect(r.perServing?.kcal).toBe(320.5);
  });

  it("has no nutrition until it is computed", () => {
    expect(recipeFromRow({ ...recipeRow, protein_per_serving: null }).perServing).toBeNull();
  });
});
