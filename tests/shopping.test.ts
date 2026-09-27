import { describe, expect, it } from "vitest";
import type { PlanSlot } from "@/lib/planner";
import { type ShoppingIngredient, type ShoppingRecipe, buildShoppingList, formatAmount, formatPacks } from "@/lib/shopping";

const ing = (id: number, name: string, extra: Partial<ShoppingIngredient> = {}): ShoppingIngredient => ({
  id,
  name,
  aisle: "other",
  purchaseUnit: "g",
  packSize: 500,
  gramsPerPiece: null,
  gramsPerMl: 1,
  searchTerm: name,
  ...extra,
});

const ingredients = [
  ing(1, "rice", { aisle: "grains", packSize: 1000 }),
  ing(2, "toor dal", { aisle: "pulses" }),
  ing(3, "ghee", { aisle: "oils", purchaseUnit: "ml", packSize: 500, gramsPerMl: 0.9 }),
  ing(4, "egg", { aisle: "dairy", purchaseUnit: "piece", packSize: 6, gramsPerPiece: 50 }),
  ing(5, "water"),
  ing(6, "salt", { aisle: "spices", packSize: 1000 }),
];

// Dal rice serves 4: 200 g rice, 150 g dal, 20 g ghee, 600 g water, 5 g salt.
const dalRice: ShoppingRecipe = {
  id: 10,
  servings: 4,
  lines: [
    { ingredientId: 1, grams: 200 },
    { ingredientId: 2, grams: 150 },
    { ingredientId: 3, grams: 20 },
    { ingredientId: 5, grams: 600 },
    { ingredientId: 6, grams: 5 },
  ],
};
// Egg bhurji serves 2: 4 eggs (200 g) + 10 g ghee.
const bhurji: ShoppingRecipe = { id: 11, servings: 2, lines: [{ ingredientId: 4, grams: 200 }, { ingredientId: 3, grams: 10 }] };

const slot = (day: number, meal: PlanSlot["meal"], recipeId: number, portion: number): PlanSlot => ({
  day,
  meal,
  recipeId,
  portion,
  locked: false,
  isLeftover: false,
});

describe("buildShoppingList", () => {
  // Dal rice eaten as 2 servings on 3 days = 6 servings (1.5× the recipe); bhurji 1 serving twice = 1× recipe.
  const slots = [slot(0, "lunch", 10, 2), slot(2, "lunch", 10, 2), slot(4, "dinner", 10, 2), slot(1, "breakfast", 11, 1), slot(3, "breakfast", 11, 1)];
  const list = buildShoppingList(slots, [dalRice, bhurji], ingredients, new Set());
  const find = (name: string) => list.aisles.flatMap((a) => a.items).find((i) => i.name === name);

  it("scales each recipe by the servings eaten and combines across the week", () => {
    expect(find("rice")).toMatchObject({ amount: 300, unit: "g", packs: 1, mealCount: 3 });
    expect(find("toor dal")).toMatchObject({ amount: 230, unit: "g", packs: 1 }); // 225 g → rounded up to 230
  });

  it("converts to what shops sell: ml for liquids, pieces for eggs", () => {
    // ghee: 1.5 × 20 g + 1 × 10 g = 40 g ÷ 0.9 g/ml = 44.4 ml → 45 ml
    expect(find("ghee")).toMatchObject({ amount: 45, unit: "ml", packs: 1 });
    // eggs: 200 g ÷ 50 g = 4 pieces, sold in 6s → 1 pack
    expect(find("egg")).toMatchObject({ amount: 4, unit: "piece", packs: 1 });
  });

  it("rounds packs up", () => {
    const big = buildShoppingList([slot(0, "lunch", 10, 16)], [dalRice], ingredients, new Set());
    // 16 servings = 4× recipe = 800 g rice → 1 × 1 kg; 600 g dal → 2 × 500 g
    const items = big.aisles.flatMap((a) => a.items);
    expect(items.find((i) => i.name === "rice")?.packs).toBe(1);
    expect(items.find((i) => i.name === "toor dal")?.packs).toBe(2);
  });

  it("never lists water", () => {
    expect(find("water")).toBeUndefined();
  });

  it("groups by shop aisle in store order", () => {
    expect(list.aisles.map((a) => a.aisle)).toEqual(["dairy", "grains", "pulses", "spices", "oils"]);
  });

  it("moves pantry items out of the list", () => {
    const withPantry = buildShoppingList(slots, [dalRice, bhurji], ingredients, new Set([6]));
    expect(withPantry.aisles.flatMap((a) => a.items).map((i) => i.name)).not.toContain("salt");
    expect(withPantry.pantry.map((i) => i.name)).toEqual(["salt"]);
  });

  it("falls back to grams when a piece item has no weight per piece", () => {
    const odd = [...ingredients.filter((i) => i.id !== 4), ing(4, "egg", { purchaseUnit: "piece", packSize: 6, gramsPerPiece: null })];
    const result = buildShoppingList([slot(0, "breakfast", 11, 2)], [bhurji], odd, new Set());
    expect(result.aisles.flatMap((a) => a.items).find((i) => i.name === "egg")).toMatchObject({ unit: "g", amount: 200 });
  });

  it("is empty for an empty plan", () => {
    expect(buildShoppingList([], [dalRice], ingredients, new Set())).toEqual({ aisles: [], pantry: [] });
  });
});

describe("formatting", () => {
  it("formats amounts", () => {
    expect(formatAmount(740, "g")).toBe("740 g");
    expect(formatAmount(1250, "g")).toBe("1.25 kg");
    expect(formatAmount(1500, "ml")).toBe("1.5 L");
    expect(formatAmount(1, "piece")).toBe("1 piece");
    expect(formatAmount(2.5, "g")).toBe("2.5 g");
  });

  it("formats packs", () => {
    expect(formatPacks({ packs: 2, packSize: 500, unit: "g" })).toBe("Buy 2 × 500 g");
    expect(formatPacks({ packs: 1, packSize: 1000, unit: "g" })).toBe("Buy 1 × 1 kg");
    expect(formatPacks({ packs: 1, packSize: 6, unit: "piece" })).toBe("Buy 1 pack of 6");
  });
});
