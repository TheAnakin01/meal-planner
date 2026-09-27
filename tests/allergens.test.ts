import { describe, expect, it } from "vitest";
import { checkRecipeSafety, filterSafeRecipes } from "@/lib/allergen-safety";
import { ALLERGEN_IDS, type AllergenId } from "@/lib/allergens";
import type { Recipe } from "@/lib/spoonacular";

function recipe(title: string, ingredients: string[], flags: Partial<Recipe> = {}): Recipe {
  return {
    id: Math.floor(Math.random() * 1e6),
    title,
    imageUrl: null,
    sourceUrl: "https://example.com",
    sourceName: null,
    servings: 1,
    readyInMinutes: null,
    calories: 500,
    proteinG: 20,
    carbsG: 50,
    fatG: 15,
    ingredients,
    dairyFree: true,
    glutenFree: true,
    ...flags,
  };
}

const safe = (r: Recipe, allergies: AllergenId[], other: string[] = []) =>
  checkRecipeSafety(r, allergies, other).safe;

describe("real Spoonacular results that its own dairy filter let through (2026-09-27)", () => {
  it("rejects the breakfast sausage scramble flagged dairyFree=false", () => {
    const r = recipe(
      "Turkey Sausage, Chard & Sweet Potato Breakfast Scramble",
      ["baby portabella mushrooms", "diestel breakfast sausage", "rainbow chard", "eggs", "olive oil", "sweet potato"],
      { dairyFree: false },
    );
    expect(safe(r, ["dairy-free"])).toBe(false);
  });

  it("rejects chocolate chips for dairy even when Spoonacular says dairy-free", () => {
    const r = recipe("Vanilla Bean Cherry Granola Bars", ["old fashioned oats", "semi-sweet chocolate chips", "cherries"]);
    expect(safe(r, ["dairy-free"])).toBe(false);
  });
});

describe("keyword matching", () => {
  it.each<[AllergenId, string]>([
    ["peanut-free", "peanut butter"],
    ["peanut-free", "chicken satay"],
    ["tree-nut-free", "toasted walnuts"],
    ["tree-nut-free", "almond flour"],
    ["dairy-free", "unsalted butter"],
    ["dairy-free", "Crème fraîche"],
    ["dairy-free", "grated parmesan"],
    ["dairy-free", "greek yoghurt"],
    ["egg-free", "2 large eggs"],
    ["egg-free", "mayonnaise"],
    ["soy-free", "firm tofu"],
    ["soy-free", "low sodium soy sauce"],
    ["wheat-free", "all-purpose flour"],
    ["wheat-free", "whole wheat spaghetti"],
    ["wheat-free", "soy sauce"],
    ["gluten-free", "pearl barley"],
    ["gluten-free", "rolled oats"],
    ["fish-free", "anchovies"],
    ["fish-free", "worcestershire sauce"],
    ["shellfish-free", "jumbo shrimp"],
    ["shellfish-free", "oyster sauce"],
    ["crustacean-free", "lobster tail"],
    ["mollusk-free", "mussels"],
    ["sesame-free", "tahini"],
    ["sesame-free", "toasted sesame oil"],
    ["mustard-free", "dijon"],
    ["celery-free", "vegetable broth"],
    ["lupine-free", "lupini beans"],
    ["sulfite-free", "red wine vinegar"],
    ["sulfite-free", "golden raisins"],
  ])("%s rejects %s", (allergy, ingredient) => {
    expect(safe(recipe("Test dish", [ingredient]), [allergy])).toBe(false);
  });

  it("checks the recipe title too, including describing words", () => {
    expect(safe(recipe("Cheesy Broccoli Bake", ["broccoli"]), ["dairy-free"])).toBe(false);
    expect(safe(recipe("Creamy Tomato Soup", ["tomatoes"]), ["dairy-free"])).toBe(false);
    expect(safe(recipe("Breaded Chicken", ["chicken"]), ["wheat-free"])).toBe(false);
  });

  it("uses Spoonacular's gluten flag for wheat and gluten allergies", () => {
    const r = recipe("Rice bowl", ["rice"], { glutenFree: false });
    expect(safe(r, ["gluten-free"])).toBe(false);
    expect(safe(r, ["wheat-free"])).toBe(false);
    expect(safe(r, ["peanut-free"])).toBe(true);
  });
});

describe("avoids obvious false alarms", () => {
  it.each<[AllergenId, string]>([
    ["dairy-free", "coconut milk"],
    ["dairy-free", "almond milk"],
    ["dairy-free", "cream of tartar"],
    ["dairy-free", "dairy-free chocolate chips"],
    ["dairy-free", "non-dairy creamer"],
    ["dairy-free", "vegan butter"],
    ["dairy-free", "butternut squash"],
    ["egg-free", "eggplant"],
    ["tree-nut-free", "coconut"],
    ["tree-nut-free", "nutmeg"],
    ["tree-nut-free", "butternut squash"],
    ["peanut-free", "almonds"],
    ["wheat-free", "buckwheat groats"],
    ["wheat-free", "rice flour"],
    ["wheat-free", "gluten-free pasta"],
    ["gluten-free", "goat cheese"],
    ["gluten-free", "kale"],
    ["fish-free", "codiaeum leaves"],
    ["sulfite-free", "portobello mushrooms"],
  ])("%s allows %s", (allergy, ingredient) => {
    expect(safe(recipe("Test dish", [ingredient]), [allergy])).toBe(true);
  });

  it("a safe phrase for one allergy does not hide another allergy", () => {
    // Peanut butter is dairy-free but obviously not peanut-free.
    const r = recipe("PB toast", ["peanut butter"]);
    expect(safe(r, ["dairy-free"])).toBe(true);
    expect(safe(r, ["dairy-free", "peanut-free"])).toBe(false);
    // Almond milk is dairy-free but not tree-nut-free.
    expect(safe(recipe("Smoothie", ["almond milk"]), ["tree-nut-free"])).toBe(false);
  });
});

describe("other (free-text) allergies", () => {
  it("matches singular and plural forms", () => {
    expect(safe(recipe("Fruit salad", ["strawberries", "banana"]), [], ["strawberry"])).toBe(false);
    expect(safe(recipe("Fruit salad", ["kiwi"]), [], ["kiwis"])).toBe(false);
    expect(safe(recipe("Peach cobbler", ["peaches"]), [], ["peach"])).toBe(false);
  });

  it("does not match inside other words", () => {
    expect(safe(recipe("Salad", ["pineapple"]), [], ["apple"])).toBe(true);
  });
});

describe("general behaviour", () => {
  it("allows anything when no allergies are set", () => {
    expect(safe(recipe("Anything", ["peanuts", "milk", "shrimp"]), [])).toBe(true);
  });

  it("every allergy option has a rule that catches its own name", () => {
    const names: Record<AllergenId, string> = {
      "peanut-free": "peanut", "tree-nut-free": "walnut", "dairy-free": "milk", "egg-free": "egg",
      "soy-free": "soy", "wheat-free": "wheat", "gluten-free": "gluten flour", "fish-free": "fish",
      "shellfish-free": "shellfish", "crustacean-free": "crab", "mollusk-free": "clam", "sesame-free": "sesame",
      "mustard-free": "mustard", "celery-free": "celery", "lupine-free": "lupin", "sulfite-free": "sulfite",
    };
    for (const id of ALLERGEN_IDS) {
      expect(safe(recipe("Test", [names[id]]), [id]), id).toBe(false);
    }
  });

  it("reports why a recipe was rejected", () => {
    const result = checkRecipeSafety(recipe("Test", ["butter", "shrimp"]), ["dairy-free", "shellfish-free"], []);
    expect(result.reasons).toEqual(['dairy-free: "butter"', 'shellfish-free: "shrimp"']);
  });

  it("filterSafeRecipes keeps only safe recipes", () => {
    const ok = recipe("Oat bowl", ["oats", "blueberries"]);
    const bad = recipe("Omelette", ["eggs", "spinach"]);
    expect(filterSafeRecipes([ok, bad], ["egg-free"], [])).toEqual([ok]);
  });
});
