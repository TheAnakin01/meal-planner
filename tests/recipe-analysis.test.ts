import { describe, expect, it } from "vitest";
import {
  type AnalysisIngredient,
  analyzeRecipe,
  computeAllergens,
  computeDietTypes,
  computeNutrition,
  looksCooked,
  suggestIngredientTags,
} from "@/lib/recipe-analysis";

function ing(name: string, per100g: [number, number, number, number, number] | null, flags: Partial<AnalysisIngredient> = {}): AnalysisIngredient {
  return {
    name,
    aliases: [],
    per100g: per100g && { kcal: per100g[0], proteinG: per100g[1], carbsG: per100g[2], fatG: per100g[3], fiberG: per100g[4] },
    allergenTags: [],
    containsMeat: false,
    containsFish: false,
    containsEgg: false,
    containsDairy: false,
    containsHoney: false,
    jainAvoid: false,
    ...flags,
  };
}

const moongDal = ing("moong dal", [347, 24, 63, 1.2, 16]);
const rice = ing("basmati rice", [360, 7, 79, 0.6, 1]);
const ghee = ing("ghee", [900, 0, 0, 100, 0], { allergenTags: ["dairy-free"], containsDairy: true });
const onion = ing("onion", [40, 1.1, 9.3, 0.1, 1.7], { jainAvoid: true });
const chicken = ing("chicken breast", [165, 31, 0, 3.6, 0], { containsMeat: true });
const paneer = ing("paneer", [265, 18, 3, 21, 0], { allergenTags: ["dairy-free"], containsDairy: true });
const egg = ing("egg", [143, 12.6, 0.7, 9.5, 0], { allergenTags: ["egg-free"], containsEgg: true });

describe("computeNutrition", () => {
  it("adds ingredients by weight and divides by servings", () => {
    // 200 g dal + 200 g rice + 20 g ghee, 4 servings
    const { perServing, missing } = computeNutrition(
      [
        { grams: 200, ingredient: moongDal },
        { grams: 200, ingredient: rice },
        { grams: 20, ingredient: ghee },
      ],
      4,
    );
    expect(missing).toEqual([]);
    // kcal: (694 + 720 + 180) / 4 = 398.5
    expect(perServing).toEqual({ kcal: 398.5, proteinG: 15.5, carbsG: 71, fatG: 5.9, fiberG: 8.5 });
  });

  it("returns no nutrition while any ingredient is missing data, and lists them", () => {
    const result = computeNutrition([{ grams: 100, ingredient: rice }, { grams: 5, ingredient: ing("curry leaves", null) }], 2);
    expect(result.perServing).toBeNull();
    expect(result.missing).toEqual(["curry leaves"]);
  });

  it("returns nothing for an empty recipe", () => {
    expect(computeNutrition([], 2).perServing).toBeNull();
  });
});

describe("computeAllergens", () => {
  it("combines ingredient tags with the word check", () => {
    const { tags, warnings } = computeAllergens("Dal Tadka", [
      { grams: 200, ingredient: moongDal },
      { grams: 20, ingredient: ghee },
    ]);
    expect(tags).toEqual(["dairy-free"]);
    expect(warnings).toEqual([]);
  });

  it("still flags an allergen the owner forgot to tag, and warns about it", () => {
    const untaggedButter = ing("butter", [717, 0.9, 0.1, 81, 0]);
    const { tags, warnings } = computeAllergens("Toast", [{ grams: 10, ingredient: untaggedButter }]);
    expect(tags).toEqual(["dairy-free"]);
    expect(warnings[0]).toContain('"butter" suggests dairy');
  });

  it("trusts a tag even when the name gives no hint", () => {
    const mysteryPowder = ing("sambar powder", [300, 10, 50, 5, 10], { allergenTags: ["mustard-free"] });
    expect(computeAllergens("Sambar", [{ grams: 10, ingredient: mysteryPowder }]).tags).toEqual(["mustard-free"]);
  });
});

describe("computeDietTypes", () => {
  it("dal with rice and ghee suits every diet except vegan", () => {
    const { dietTypes } = computeDietTypes("Dal Chawal", [
      { grams: 200, ingredient: moongDal },
      { grams: 200, ingredient: rice },
      { grams: 20, ingredient: ghee },
    ]);
    expect(dietTypes).toEqual(["veg", "eggetarian", "jain", "nonveg"]);
  });

  it("onion rules out Jain; egg rules out vegetarian; meat leaves only non-veg", () => {
    expect(computeDietTypes("Dal", [{ grams: 50, ingredient: moongDal }, { grams: 30, ingredient: onion }]).dietTypes).toEqual([
      "veg",
      "eggetarian",
      "vegan",
      "nonveg",
    ]);
    expect(computeDietTypes("Bhurji", [{ grams: 100, ingredient: egg }]).dietTypes).toEqual(["eggetarian", "nonveg"]);
    expect(computeDietTypes("Chicken", [{ grams: 150, ingredient: chicken }]).dietTypes).toEqual(["nonveg"]);
  });

  it("the word check overrides missing flags, with a warning", () => {
    const unflaggedChicken = ing("chicken thighs", [200, 25, 0, 11, 0]);
    const { dietTypes, warnings } = computeDietTypes("Curry", [{ grams: 150, ingredient: unflaggedChicken }]);
    expect(dietTypes).toEqual(["nonveg"]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("analyzeRecipe", () => {
  it("returns nutrition, allergens and diets together", () => {
    const result = analyzeRecipe("Palak Paneer", 2, [{ grams: 200, ingredient: paneer }]);
    expect(result.nutrition.perServing?.kcal).toBe(265);
    expect(result.allergens.tags).toEqual(["dairy-free"]);
    expect(result.diets.dietTypes).toEqual(["veg", "eggetarian", "jain", "nonveg"]);
  });
});

describe("suggestIngredientTags", () => {
  it("suggests tags from the name", () => {
    expect(suggestIngredientTags("paneer")).toMatchObject({ allergenTags: ["dairy-free"], containsDairy: true });
    expect(suggestIngredientTags("garlic")).toMatchObject({ allergenTags: [], jainAvoid: true });
    expect(suggestIngredientTags("prawns")).toMatchObject({
      allergenTags: ["shellfish-free", "crustacean-free"],
      containsFish: true,
    });
    expect(suggestIngredientTags("whole wheat flour").allergenTags).toEqual(["wheat-free", "gluten-free"]);
    expect(suggestIngredientTags("mutton")).toMatchObject({ containsMeat: true });
    // Besan is chickpea flour: "flour" alone would suggest wheat, but "chickpea flour" is a known safe phrase.
    expect(suggestIngredientTags("besan", ["chickpea flour"]).allergenTags).toEqual([]);
  });
});

describe("looksCooked", () => {
  it("flags dry staples saved with cooked values (like rice at 112 kcal)", () => {
    expect(looksCooked("rice", "other", 112)).toBe(true);
    expect(looksCooked("toor dal", "pulses", 120)).toBe(true);
    expect(looksCooked("anything", "grains", 130)).toBe(true);
  });

  it("accepts raw values and non-staples", () => {
    expect(looksCooked("basmati rice", "grains", 356)).toBe(false);
    expect(looksCooked("onion", "produce", 38)).toBe(false);
    expect(looksCooked("water", "other", 0)).toBe(false);
    expect(looksCooked("moong sprouts", "produce", 30)).toBe(false);
  });
});
