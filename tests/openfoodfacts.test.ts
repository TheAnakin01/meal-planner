import { describe, expect, it } from "vitest";
import { isValidBarcode, nutrientsForGrams, parseOffResponse, productWarnings } from "@/lib/openfoodfacts";

// Shaped like real Open Food Facts v2 responses (checked 2026-09-27).
const maggi = {
  status: 1,
  product: {
    product_name: "Maggi 2-minutes Noodles",
    brands: "Maggi, Nestlé",
    serving_quantity: 70,
    allergens_tags: ["en:gluten"],
    traces_tags: ["en:milk"],
    ingredients_text: "Noodles (refined wheat flour (maida), palm oil, salt), tastemaker (spices, onion powder, garlic powder)",
    image_front_small_url: "https://images.openfoodfacts.org/images/products/890/105/885/1298/front_en.jpg",
    nutriments: { "energy-kcal_100g": 437, proteins_100g: 10.4, carbohydrates_100g: 44.5, fat_100g: 15.7 },
  },
};

describe("parseOffResponse", () => {
  it("reads name, nutrition per 100 g, serving size and allergens", () => {
    expect(parseOffResponse("8901058851298", maggi)).toEqual({
      barcode: "8901058851298",
      name: "Maggi 2-minutes Noodles",
      brand: "Maggi",
      per100g: { kcal: 437, proteinG: 10.4, carbsG: 44.5, fatG: 15.7, fiberG: 0 },
      servingGrams: 70,
      allergens: ["gluten-free"],
      traces: ["dairy-free"],
      ingredientsText: maggi.product.ingredients_text,
      imageUrl: maggi.product.image_front_small_url,
    });
  });

  it("returns null for unknown barcodes", () => {
    expect(parseOffResponse("8901063010031", { status: 0, status_verbose: "product not found" })).toBeNull();
    expect(parseOffResponse("1", null)).toBeNull();
  });

  it("copes with missing or odd data", () => {
    const p = parseOffResponse("12345678", { status: 1, product: { nutriments: { "energy-kcal_100g": "abc" }, image_front_small_url: "https://evil.example/x.jpg" } });
    expect(p).toMatchObject({ name: "Product 12345678", brand: null, per100g: null, servingGrams: null, imageUrl: null });
  });
});

describe("productWarnings", () => {
  const product = parseOffResponse("8901058851298", maggi)!;

  it("flags declared allergens and ingredient words", () => {
    expect(productWarnings(product, ["gluten-free"], []).contains).toEqual(["Gluten"]);
    expect(productWarnings(product, ["wheat-free"], []).contains).toEqual(["Wheat"]); // "wheat flour" in ingredients
  });

  it("reports 'may contain' traces separately", () => {
    expect(productWarnings(product, ["dairy-free"], [])).toMatchObject({ contains: [], mayContain: ["Dairy / milk"] });
  });

  it("checks free-text allergies", () => {
    expect(productWarnings(product, [], ["garlic"]).contains).toEqual(["garlic"]);
  });

  it("says when there is no ingredient list to check", () => {
    const bare = parseOffResponse("12345678", { status: 1, product: { product_name: "Mystery snack" } })!;
    expect(productWarnings(bare, ["peanut-free"], [])).toEqual({ contains: [], mayContain: [], unknownIngredients: true });
  });
});

describe("helpers", () => {
  it("validates barcodes", () => {
    expect(isValidBarcode("8901058851298")).toBe(true);
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("89010588512a8")).toBe(false);
  });

  it("scales nutrition to grams eaten", () => {
    expect(nutrientsForGrams({ kcal: 437, proteinG: 10.4, carbsG: 44.5, fatG: 15.7, fiberG: 0 }, 70)).toEqual({
      kcal: 305.9,
      proteinG: 7.3,
      carbsG: 31.2,
      fatG: 11,
      fiberG: 0,
    });
  });
});
