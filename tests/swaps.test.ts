import { describe, expect, it } from "vitest";
import type { Ingredient } from "@/lib/library";
import { type SwapProfile, isSafeIngredient, suggestSwaps } from "@/lib/swaps";

let id = 1;
function ing(name: string, per100g: [number, number, number, number], extra: Partial<Ingredient> = {}): Ingredient {
  return {
    id: id++,
    name,
    aliases: [],
    fdcId: null,
    per100g: { kcal: per100g[0], proteinG: per100g[1], carbsG: per100g[2], fatG: per100g[3], fiberG: 0 },
    allergenTags: [],
    containsMeat: false,
    containsFish: false,
    containsEgg: false,
    containsDairy: false,
    containsHoney: false,
    jainAvoid: false,
    aisle: "other",
    purchaseUnit: "g",
    packSize: 500,
    gramsPerPiece: null,
    gramsPerMl: 1,
    searchTerm: name,
    ...extra,
  };
}

const paneer = ing("paneer", [265, 18, 3, 21], { aisle: "dairy", allergenTags: ["dairy-free"], containsDairy: true });
const tofu = ing("firm tofu", [144, 17, 3, 9], { aisle: "dairy", allergenTags: ["soy-free"] });
const chicken = ing("chicken breast", [165, 31, 0, 3.6], { aisle: "meat_fish", containsMeat: true });
const eggs = ing("egg", [143, 12.6, 0.7, 9.5], { aisle: "dairy", allergenTags: ["egg-free"], containsEgg: true });
const soyaChunks = ing("soya chunks", [345, 52, 33, 0.5], { aisle: "pulses", allergenTags: ["soy-free"] });
const rice = ing("basmati rice", [356, 7, 79, 0.6], { aisle: "grains" });
const ghee = ing("ghee", [876, 0, 0, 99.5], { aisle: "oils", allergenTags: ["dairy-free"], containsDairy: true });
const oil = ing("sunflower oil", [884, 0, 0, 100], { aisle: "oils" });
const butter = ing("butter", [717, 0.9, 0.1, 81], { aisle: "dairy" }); // tag forgotten on purpose
const library = [paneer, tofu, chicken, eggs, soyaChunks, rice, ghee, oil, butter];

const person = (p: Partial<SwapProfile> = {}): SwapProfile => ({ allergies: [], otherAllergies: [], dietType: "nonveg", ...p });

describe("isSafeIngredient", () => {
  it("respects allergy tags, forgotten tags (word check), other allergies and diet", () => {
    expect(isSafeIngredient(tofu, person({ allergies: ["soy-free"] }))).toBe(false);
    expect(isSafeIngredient(butter, person({ allergies: ["dairy-free"] }))).toBe(false); // caught by the word "butter"
    expect(isSafeIngredient(rice, person({ otherAllergies: ["basmati"] }))).toBe(false);
    expect(isSafeIngredient(chicken, person({ dietType: "veg" }))).toBe(false);
    expect(isSafeIngredient(eggs, person({ dietType: "veg" }))).toBe(false);
    expect(isSafeIngredient(eggs, person({ dietType: "eggetarian" }))).toBe(true);
    expect(isSafeIngredient(ghee, person({ dietType: "vegan" }))).toBe(false);
  });
});

describe("suggestSwaps", () => {
  it("swaps paneer for tofu for a dairy-free vegetarian, keeping calories the same", () => {
    const swaps = suggestSwaps(paneer, 200, library, person({ allergies: ["dairy-free"], dietType: "veg" }));
    expect(swaps[0]).toEqual({ ingredient: { id: tofu.id, name: "firm tofu" }, grams: 370, kcalDiff: 3, proteinDiff: 26.9 });
    expect(swaps.map((s) => s.ingredient.name)).not.toContain("egg"); // not vegetarian
    expect(swaps.map((s) => s.ingredient.name)).not.toContain("chicken breast");
  });

  it("offers oil instead of ghee for vegans, never butter", () => {
    const swaps = suggestSwaps(ghee, 10, library, person({ dietType: "vegan" }));
    expect(swaps.map((s) => s.ingredient.name)).toEqual(["sunflower oil"]);
    expect(swaps[0].grams).toBe(10);
  });

  it("returns nothing when no safe, similar ingredient exists", () => {
    expect(suggestSwaps(rice, 150, library, person())).toEqual([]); // no other grain in the library
    expect(suggestSwaps(paneer, 200, [paneer], person())).toEqual([]);
  });

  it("never suggests something the person is allergic to, even if it's the best match", () => {
    const swaps = suggestSwaps(paneer, 200, library, person({ allergies: ["dairy-free", "soy-free"], dietType: "nonveg" }));
    expect(swaps.map((s) => s.ingredient.name)).not.toContain("firm tofu");
    expect(swaps.map((s) => s.ingredient.name)).not.toContain("soya chunks");
  });

  it("ignores ingredients without nutrition", () => {
    expect(suggestSwaps({ ...paneer, per100g: null }, 200, library, person())).toEqual([]);
  });
});
