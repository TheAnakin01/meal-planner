import { describe, expect, it } from "vitest";
import { buildUsdaSearchBody, nutrientsFromUsda, parseUsdaSearch } from "@/lib/usda";

// Real USDA response data (public domain), trimmed to the nutrients we use.
const paneer = {
  fdcId: 2705740,
  description: "Cheese, paneer",
  dataType: "Survey (FNDDS)",
  foodNutrients: [
    { nutrientNumber: "203", nutrientName: "Protein", unitName: "G", value: 15.86 },
    { nutrientNumber: "204", nutrientName: "Total lipid (fat)", unitName: "G", value: 15.52 },
    { nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", unitName: "G", value: 22.46 },
    { nutrientNumber: "208", nutrientName: "Energy", unitName: "KCAL", value: 299 },
    { nutrientNumber: "291", nutrientName: "Fiber, total dietary", unitName: "G", value: 0 },
  ],
};

// Foundation foods often have only Atwater energy (957/958), not 208.
const blackRice = {
  fdcId: 2710825,
  description: "Rice, black, unenriched, raw",
  dataType: "Foundation",
  foodNutrients: [
    { nutrientNumber: "204", unitName: "G", value: 3.44 },
    { nutrientNumber: "291", unitName: "G", value: 4.18 },
    { nutrientNumber: "203", unitName: "G", value: 7.57 },
    { nutrientNumber: "205", unitName: "G", value: 77.2 },
    { nutrientNumber: "957", unitName: "KCAL", value: 370 },
    { nutrientNumber: "958", unitName: "KCAL", value: 361 },
  ],
};

describe("buildUsdaSearchBody", () => {
  it("searches generic foods only, never branded products", () => {
    expect(buildUsdaSearchBody("  paneer ")).toEqual({
      query: "paneer",
      pageSize: 10,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    });
  });
});

describe("nutrientsFromUsda", () => {
  it("reads per-100 g values", () => {
    expect(nutrientsFromUsda(paneer.foodNutrients)).toEqual({
      kcal: 299,
      proteinG: 15.86,
      carbsG: 22.46,
      fatG: 15.52,
      fiberG: 0,
    });
  });

  it("falls back to Atwater-specific energy when 208 is missing", () => {
    expect(nutrientsFromUsda(blackRice.foodNutrients)?.kcal).toBe(361);
  });

  it("ignores energy reported in kJ", () => {
    const n = nutrientsFromUsda([
      { nutrientNumber: "203", value: 10 },
      { nutrientNumber: "204", value: 10 },
      { nutrientNumber: "205", value: 10 },
      { nutrientNumber: "208", unitName: "kJ", value: 900 },
    ]);
    expect(n?.kcal).toBe(170); // estimated 10*4 + 10*4 + 10*9
  });

  it("returns null when a macro is missing", () => {
    expect(nutrientsFromUsda([{ nutrientNumber: "208", unitName: "KCAL", value: 100 }])).toBeNull();
  });
});

describe("parseUsdaSearch", () => {
  it("returns foods with usable nutrition and skips broken ones", () => {
    const foods = parseUsdaSearch({ foods: [paneer, blackRice, { fdcId: "x" }, { ...paneer, fdcId: 1, foodNutrients: [] }] });
    expect(foods.map((f) => f.description)).toEqual(["Cheese, paneer", "Rice, black, unenriched, raw"]);
    expect(foods[0].per100g.kcal).toBe(299);
  });

  it("returns an empty list for unexpected responses", () => {
    expect(parseUsdaSearch(null)).toEqual([]);
    expect(parseUsdaSearch("<html>400 Bad Request</html>")).toEqual([]);
  });
});
