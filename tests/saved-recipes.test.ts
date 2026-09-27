import { describe, expect, it } from "vitest";
import { savedRecipeSchema, spoonacularRecipeUrl } from "@/lib/saved-recipes";

const valid = {
  recipeId: 716429,
  title: "Pasta with Garlic, Scallions, Cauliflower & Breadcrumbs",
  imageUrl: "https://img.spoonacular.com/recipes/716429-312x231.jpg",
  mealType: "dinner",
};

describe("savedRecipeSchema", () => {
  it("accepts the three fields Spoonacular lets us store, plus meal type", () => {
    expect(savedRecipeSchema.safeParse(valid).success).toBe(true);
    expect(savedRecipeSchema.safeParse({ ...valid, imageUrl: null }).success).toBe(true);
  });

  it("rejects images from anywhere except Spoonacular's image server", () => {
    expect(savedRecipeSchema.safeParse({ ...valid, imageUrl: "https://evil.example/x.jpg" }).success).toBe(false);
  });

  it("rejects bad ids, empty titles and unknown meal types", () => {
    expect(savedRecipeSchema.safeParse({ ...valid, recipeId: -1 }).success).toBe(false);
    expect(savedRecipeSchema.safeParse({ ...valid, recipeId: 1.5 }).success).toBe(false);
    expect(savedRecipeSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
    expect(savedRecipeSchema.safeParse({ ...valid, mealType: "snack" }).success).toBe(false);
  });

  it("drops any extra fields (e.g. nutrition) so they can never be stored", () => {
    const parsed = savedRecipeSchema.parse({ ...valid, calories: 500, sourceUrl: "https://example.com" });
    expect(Object.keys(parsed).sort()).toEqual(["imageUrl", "mealType", "recipeId", "title"]);
  });
});

describe("spoonacularRecipeUrl", () => {
  it("builds a readable Spoonacular link ending in the recipe id", () => {
    expect(spoonacularRecipeUrl(716429, valid.title)).toBe(
      "https://spoonacular.com/recipes/pasta-with-garlic-scallions-cauliflower-breadcrumbs-716429",
    );
  });

  it("handles accents and titles with no letters", () => {
    expect(spoonacularRecipeUrl(1, "Crème Brûlée")).toBe("https://spoonacular.com/recipes/creme-brulee-1");
    expect(spoonacularRecipeUrl(2, "!!!")).toBe("https://spoonacular.com/recipes/2");
  });
});
