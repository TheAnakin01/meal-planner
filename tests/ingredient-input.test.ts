import { describe, expect, it } from "vitest";
import { type IngredientInput, ingredientInputSchema, ingredientInputToRow } from "@/lib/ingredient-input";

const valid: IngredientInput = {
  name: "paneer",
  aliases: ["cottage cheese"],
  fdcId: 2705740,
  per100g: { kcal: 265, proteinG: 18.3, carbsG: 1.2, fatG: 20.8, fiberG: 0 },
  allergenTags: ["dairy-free"],
  containsMeat: false,
  containsFish: false,
  containsEgg: false,
  containsDairy: true,
  containsHoney: false,
  jainAvoid: false,
  aisle: "dairy",
  purchaseUnit: "g",
  packSize: 200,
  gramsPerPiece: null,
  gramsPerMl: 1,
  searchTerm: "paneer",
};

const issues = (input: unknown) => {
  const r = ingredientInputSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("ingredientInputSchema", () => {
  it("accepts a valid ingredient and lowercases names", () => {
    const r = ingredientInputSchema.safeParse({ ...valid, name: "  Paneer ", aliases: ["Cottage Cheese"] });
    expect(r.success && r.data.name).toBe("paneer");
    expect(r.success && r.data.aliases).toEqual(["cottage cheese"]);
  });

  it("rejects impossible nutrition", () => {
    expect(issues({ ...valid, per100g: { ...valid.per100g, kcal: 1200 } })).toEqual(["Calories looks too high."]);
    expect(issues({ ...valid, per100g: { ...valid.per100g, proteinG: 60, fatG: 60 } })).toEqual([
      "Protein + carbs + fat can't be more than 100 g per 100 g.",
    ]);
    expect(issues({ ...valid, per100g: { ...valid.per100g, fatG: NaN } })).toHaveLength(1);
  });

  it("needs a piece weight when sold by the piece", () => {
    expect(issues({ ...valid, purchaseUnit: "piece", gramsPerPiece: null })).toEqual(["Please say how much one piece weighs."]);
    expect(issues({ ...valid, purchaseUnit: "piece", gramsPerPiece: 50 })).toEqual([]);
  });

  it("rejects odd characters and unknown allergen tags", () => {
    expect(issues({ ...valid, name: "<b>paneer</b>" })).toHaveLength(1);
    expect(issues({ ...valid, allergenTags: ["chocolate-free"] })).toHaveLength(1);
  });
});

describe("ingredientInputToRow", () => {
  it("maps to database columns, dropping aliases equal to the name and irrelevant unit fields", () => {
    const row = ingredientInputToRow({ ...valid, aliases: ["paneer", "cottage cheese"], gramsPerPiece: 99, gramsPerMl: 0.9 });
    expect(row.aliases).toEqual(["cottage cheese"]);
    expect(row.grams_per_piece).toBeNull();
    expect(row.grams_per_ml).toBe(1);
    expect(row.kcal_per_100g).toBe(265);
    expect(row.contains_dairy).toBe(true);
  });
});
