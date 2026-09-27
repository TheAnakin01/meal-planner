import { describe, expect, it } from "vitest";
import { spoonacularExcludes, spoonacularIntolerances } from "@/lib/allergens";
import { buildSearchParams, parseRecipe, parseSearchResponse } from "@/lib/spoonacular";

const target = { calories: 500, min: 425, max: 575 };

// Shaped like a real complexSearch result with addRecipeNutrition=true.
function rawRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    title: "Berry Oat Bowl",
    image: "https://img.spoonacular.com/recipes/101-312x231.jpg",
    sourceUrl: "https://example.com/berry-oat-bowl",
    sourceName: "Example Kitchen",
    servings: 2,
    readyInMinutes: 10,
    dairyFree: true,
    glutenFree: false,
    nutrition: {
      nutrients: [
        { name: "Calories", amount: 480.4, unit: "kcal" },
        { name: "Fat", amount: 12.2, unit: "g" },
        { name: "Carbohydrates", amount: 70.6, unit: "g" },
        { name: "Protein", amount: 18.4, unit: "g" },
      ],
      ingredients: [{ name: "Rolled Oats" }, { name: "blueberries" }],
    },
    ...overrides,
  };
}

describe("allergen mapping", () => {
  it("maps selected allergies to Spoonacular intolerances, deduplicated and sorted", () => {
    expect(
      spoonacularIntolerances(["shellfish-free", "crustacean-free", "peanut-free", "fish-free"]),
    ).toEqual(["peanut", "seafood", "shellfish"]);
  });

  it("maps allergies without a Spoonacular intolerance to excluded ingredients", () => {
    expect(spoonacularIntolerances(["mustard-free"])).toEqual([]);
    expect(spoonacularExcludes(["celery-free", "mustard-free"], ["kiwi"])).toEqual([
      "celeriac",
      "celery",
      "kiwi",
      "mustard",
    ]);
  });
});

describe("buildSearchParams", () => {
  it("builds a breakfast search with calorie range and allergy filters", () => {
    const params = buildSearchParams({
      meal: "breakfast",
      target,
      allergies: ["dairy-free", "sesame-free", "lupine-free"],
      otherAllergies: ["kiwi"],
    });
    expect(Object.fromEntries(params)).toEqual({
      type: "breakfast",
      minCalories: "425",
      maxCalories: "575",
      addRecipeNutrition: "true",
      sort: "random",
      number: "6",
      intolerances: "dairy,sesame",
      excludeIngredients: "kiwi,lupin,lupine",
    });
  });

  it("uses main course for lunch and dinner and omits empty filters", () => {
    const params = buildSearchParams({ meal: "dinner", target, allergies: [], otherAllergies: [] });
    expect(params.get("type")).toBe("main course");
    expect(params.has("intolerances")).toBe(false);
    expect(params.has("excludeIngredients")).toBe(false);
  });

  it("never includes the API key", () => {
    const params = buildSearchParams({ meal: "lunch", target, allergies: [], otherAllergies: [] });
    expect(params.has("apiKey")).toBe(false);
  });
});

describe("parseRecipe", () => {
  it("extracts per-serving nutrition and lowercase ingredient names", () => {
    expect(parseRecipe(rawRecipe())).toEqual({
      id: 101,
      title: "Berry Oat Bowl",
      imageUrl: "https://img.spoonacular.com/recipes/101-312x231.jpg",
      sourceUrl: "https://example.com/berry-oat-bowl",
      sourceName: "Example Kitchen",
      servings: 2,
      readyInMinutes: 10,
      calories: 480,
      proteinG: 18,
      carbsG: 71,
      fatG: 12,
      ingredients: ["rolled oats", "blueberries"],
      dairyFree: true,
      glutenFree: false,
    });
  });

  it("falls back to the spoonacular page when there is no source URL", () => {
    const recipe = parseRecipe(
      rawRecipe({ sourceUrl: undefined, spoonacularSourceUrl: "https://spoonacular.com/r-101" }),
    );
    expect(recipe?.sourceUrl).toBe("https://spoonacular.com/r-101");
  });

  it("rejects recipes missing calories or ingredients (they can't be safety-checked)", () => {
    expect(parseRecipe(rawRecipe({ nutrition: { nutrients: [], ingredients: [{ name: "oats" }] } }))).toBeNull();
    expect(
      parseRecipe(rawRecipe({ nutrition: { nutrients: [{ name: "Calories", amount: 400 }], ingredients: [] } })),
    ).toBeNull();
    expect(parseRecipe({ title: "no id" })).toBeNull();
  });
});

describe("parseSearchResponse", () => {
  it("keeps only valid recipes inside the calorie range", () => {
    const body = {
      results: [
        rawRecipe(),
        rawRecipe({
          id: 102,
          nutrition: { nutrients: [{ name: "Calories", amount: 900 }], ingredients: [{ name: "oats" }] },
        }),
        { broken: true },
      ],
    };
    expect(parseSearchResponse(body, target).map((r) => r.id)).toEqual([101]);
  });

  it("returns an empty list for an unexpected response", () => {
    expect(parseSearchResponse(null, target)).toEqual([]);
    expect(parseSearchResponse({ message: "error" }, target)).toEqual([]);
  });
});
