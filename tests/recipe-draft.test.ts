import { describe, expect, it } from "vitest";
import {
  type RecipeDraft,
  buildDraftPrompt,
  draftSchema,
  draftToRecipeInput,
  matchDraft,
  matchIngredient,
} from "@/lib/recipe-draft";

const library = [
  { id: 2, name: "ghee", aliases: ["clarified butter"] },
  { id: 3, name: "paneer", aliases: ["cottage cheese"] },
  { id: 4, name: "onion", aliases: [] },
  { id: 5, name: "tomato", aliases: [] },
  { id: 6, name: "green chilli", aliases: ["green chili"] },
  { id: 7, name: "moong dal", aliases: ["split mung beans"] },
];

// Shaped like a real Gemini structured-output answer.
const draft: RecipeDraft = {
  title: "Paneer Bhurji",
  description: "Scrambled paneer with onion and tomato.",
  cuisine: "indian",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 12,
  ingredients: [
    { name: "paneer", grams: 200, displayAmount: "200 g" },
    { name: "onions", grams: 80, displayAmount: "1 medium" },
    { name: "tomatoes", grams: 100, displayAmount: "1 large" },
    { name: "clarified butter", grams: 10, displayAmount: "2 tsp" },
    { name: "turmeric powder", grams: 1, displayAmount: "1/4 tsp" },
  ],
  steps: ["Heat ghee", "Fry onion and tomato", "Add paneer"],
};

describe("buildDraftPrompt", () => {
  it("includes the dish, meals, servings, strict diet rules and library names", () => {
    const prompt = buildDraftPrompt(
      { description: " Jain moong dal chilla ", mealTypes: ["breakfast"], servings: 2, diet: "jain" },
      ["moong dal", "ghee"],
    );
    expect(prompt).toContain("Dish: Jain moong dal chilla");
    expect(prompt).toContain("Meal: breakfast");
    expect(prompt).toContain("NO onion, garlic, potato");
    expect(prompt).toContain("moong dal, ghee");
  });

  it("says when there is no diet restriction", () => {
    expect(buildDraftPrompt({ description: "dal", mealTypes: ["lunch"], servings: 2, diet: null }, [])).toContain(
      "Diet: no restriction.",
    );
  });
});

describe("draftSchema", () => {
  it("accepts a good answer and lowercases names", () => {
    const parsed = draftSchema.parse({ ...draft, ingredients: [{ name: "Paneer", grams: 200, displayAmount: "200 g" }] });
    expect(parsed.ingredients[0].name).toBe("paneer");
  });

  it("fills harmless gaps but rejects unusable answers", () => {
    expect(draftSchema.parse({ ...draft, prepMinutes: -5, description: 42 }).prepMinutes).toBe(10);
    expect(draftSchema.safeParse({ ...draft, ingredients: [] }).success).toBe(false);
    expect(draftSchema.safeParse({ ...draft, ingredients: [{ name: "x", grams: 0, displayAmount: "" }] }).success).toBe(false);
    expect(draftSchema.safeParse({ ...draft, steps: [] }).success).toBe(false);
    expect(draftSchema.safeParse("not json").success).toBe(false);
  });
});

describe("matchIngredient", () => {
  it("matches names, aliases, plurals and bracketed notes", () => {
    expect(matchIngredient("onions", library)?.id).toBe(4);
    expect(matchIngredient("tomatoes", library)?.id).toBe(5);
    expect(matchIngredient("Clarified Butter", library)?.id).toBe(2);
    expect(matchIngredient("green chillies", library)?.id).toBe(6);
    expect(matchIngredient("paneer (homemade)", library)?.id).toBe(3);
    expect(matchIngredient("split mung beans", library)?.id).toBe(7);
  });

  it("handles tricky plurals without over-matching", () => {
    const more = [
      { id: 10, name: "strawberry", aliases: [] },
      { id: 11, name: "dates", aliases: [] },
      { id: 12, name: "peach", aliases: [] },
      { id: 13, name: "hummus", aliases: [] },
      { id: 14, name: "potato", aliases: [] },
    ];
    expect(matchIngredient("strawberries", more)?.id).toBe(10);
    expect(matchIngredient("date", more)?.id).toBe(11);
    expect(matchIngredient("peaches", more)?.id).toBe(12);
    expect(matchIngredient("hummus", more)?.id).toBe(13);
    expect(matchIngredient("potatoes", more)?.id).toBe(14);
  });

  it("does not guess when nothing matches", () => {
    expect(matchIngredient("turmeric powder", library)).toBeNull();
    expect(matchIngredient("red onion", library)).toBeNull();
  });
});

describe("matchDraft and draftToRecipeInput", () => {
  it("marks library matches and leaves unknown ingredients unmatched", () => {
    const lines = matchDraft(draft, library);
    expect(lines.map((l) => l.ingredientId)).toEqual([3, 4, 5, 2, null]);
  });

  it("builds editor input from matched lines only, with the chosen meals", () => {
    const input = draftToRecipeInput(draft, matchDraft(draft, library), ["breakfast", "dinner"]);
    expect(input.id).toBeNull();
    expect(input.mealTypes).toEqual(["breakfast", "dinner"]);
    expect(input.lines).toEqual([
      { ingredientId: 3, grams: 200, displayAmount: "200 g", note: "" },
      { ingredientId: 4, grams: 80, displayAmount: "1 medium", note: "" },
      { ingredientId: 5, grams: 100, displayAmount: "1 large", note: "" },
      { ingredientId: 2, grams: 10, displayAmount: "2 tsp", note: "" },
    ]);
  });
});
