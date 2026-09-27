import { describe, expect, it } from "vitest";
import { type DietType, DIET_TYPE_IDS, checkRecipeDiet, filterDietRecipes } from "@/lib/diet";
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
    dairyFree: null,
    glutenFree: null,
    vegetarian: null,
    vegan: null,
    ...flags,
  };
}

const ok = (r: Recipe, diet: DietType) => checkRecipeDiet(r, diet).ok;

const paneer = recipe("Paneer Butter Masala", ["paneer", "butter", "tomatoes", "onion", "garlic", "cream"]);
const dal = recipe("Moong Dal", ["moong dal", "turmeric", "cumin seeds", "tomatoes", "ghee"]);
const omelette = recipe("Masala Omelette", ["eggs", "green chilli", "coriander"]);
const chicken = recipe("Chicken Curry", ["chicken thighs", "yogurt", "garam masala"]);
const fishFry = recipe("Fish Fry", ["pomfret", "fish masala"]);
const poha = recipe("Poha", ["flattened rice", "potatoes", "peanuts", "curry leaves"]);
const tofuBowl = recipe("Tofu Rice Bowl", ["firm tofu", "brown rice", "spinach", "maple syrup"]);

describe("checkRecipeDiet", () => {
  it("non-vegetarian allows everything", () => {
    for (const r of [paneer, dal, omelette, chicken, fishFry, poha]) expect(ok(r, "nonveg")).toBe(true);
  });

  it("vegetarian allows dairy but not meat, fish or eggs", () => {
    expect(ok(paneer, "veg")).toBe(true);
    expect(ok(dal, "veg")).toBe(true);
    expect(ok(omelette, "veg")).toBe(false);
    expect(ok(chicken, "veg")).toBe(false);
    expect(ok(fishFry, "veg")).toBe(false);
  });

  it("eggetarian allows eggs but not meat or fish", () => {
    expect(ok(omelette, "eggetarian")).toBe(true);
    expect(ok(paneer, "eggetarian")).toBe(true);
    expect(ok(chicken, "eggetarian")).toBe(false);
    expect(ok(fishFry, "eggetarian")).toBe(false);
  });

  it("vegan rejects dairy, eggs and honey but allows plant milks", () => {
    expect(ok(tofuBowl, "vegan")).toBe(true);
    expect(ok(paneer, "vegan")).toBe(false);
    expect(ok(dal, "vegan")).toBe(false); // ghee
    expect(ok(omelette, "vegan")).toBe(false);
    expect(ok(recipe("Oat porridge", ["oats", "honey"]), "vegan")).toBe(false);
    expect(ok(recipe("Smoothie", ["banana", "coconut milk"]), "vegan")).toBe(true);
  });

  it("Jain rejects onion, garlic, root vegetables, mushrooms and honey", () => {
    expect(ok(dal, "jain")).toBe(true);
    expect(ok(paneer, "jain")).toBe(false); // onion, garlic
    expect(ok(poha, "jain")).toBe(false); // potatoes
    expect(ok(recipe("Ginger tea", ["ginger", "tea"]), "jain")).toBe(false);
    expect(ok(recipe("Mushroom masala", ["button mushrooms"]), "jain")).toBe(false);
    expect(ok(omelette, "jain")).toBe(false);
  });

  it("catches fish hidden in sauces for vegetarians", () => {
    expect(ok(recipe("Caesar salad", ["romaine", "worcestershire sauce"]), "veg")).toBe(false);
    expect(ok(recipe("Thai curry", ["vegetables", "fish sauce"]), "veg")).toBe(false);
  });

  it("catches gelatin and meat stock", () => {
    expect(ok(recipe("Fruit jelly", ["gelatin", "mango"]), "veg")).toBe(false);
    expect(ok(recipe("Vegetable soup", ["carrots", "chicken stock"]), "veg")).toBe(false);
  });

  it("does not flag look-alike words", () => {
    expect(ok(recipe("Eggplant bharta", ["eggplant", "tomato"]), "veg")).toBe(true);
    expect(ok(recipe("Goat cheese salad", ["goat cheese", "beetroot"]), "veg")).toBe(true);
    expect(ok(recipe("Hamburger bun sandwich", ["bun", "cheese", "tomato"]), "veg")).toBe(true);
  });

  it("believes Spoonacular's own vegetarian and vegan labels", () => {
    expect(ok(recipe("Mystery dish", ["rice"], { vegetarian: false }), "veg")).toBe(false);
    expect(ok(recipe("Mystery dish", ["rice"], { vegan: false }), "vegan")).toBe(false);
    expect(ok(recipe("Mystery dish", ["rice"], { vegetarian: false }), "nonveg")).toBe(true);
  });

  it("every diet type has a rule", () => {
    for (const d of DIET_TYPE_IDS) expect(checkRecipeDiet(dal, d).reasons).toBeInstanceOf(Array);
  });
});

describe("filterDietRecipes", () => {
  it("keeps only recipes that fit the diet", () => {
    expect(filterDietRecipes([paneer, chicken, dal], "veg")).toEqual([paneer, dal]);
  });
});
