// Starter recipe library (CLAUDE.md §15 "seed ~80 recipes"). Written by Claude, reviewed by the owner:
// recipes are inserted as DRAFTS (source "ai") and only reach users after the owner publishes them.
//
// - Ingredient nutrition is per 100 g RAW from USDA FoodData Central (fdcId), except where fdcId is null
//   (no USDA entry; values noted below).
// - Allergen tags / diet flags here are the "primary" signal; the app's word check is the backup.
//   tests/starter-library.test.ts runs every recipe through the real allergen + diet engine.
// - The SQL file is generated from this data:  npm run seed:build  →  supabase/seed/starter-library.sql
//
// Only type imports here, so Node can run this file directly (type stripping, no path aliases needed).

import type { AllergenId } from "@/lib/allergens";
import type { AisleId, Nutrients, PurchaseUnit } from "@/lib/library";
import type { MealType } from "@/lib/nutrition";

export interface StarterIngredient {
  name: string;
  aliases: string[];
  fdcId: number | null;
  per100g: Nutrients;
  allergenTags: AllergenId[];
  containsMeat: boolean;
  containsFish: boolean;
  containsEgg: boolean;
  containsDairy: boolean;
  containsHoney: boolean;
  jainAvoid: boolean;
  aisle: AisleId;
  purchaseUnit: PurchaseUnit;
  packSize: number;
  gramsPerPiece: number | null;
  gramsPerMl: number;
  searchTerm: string;
  existing?: boolean; // already in the owner's database (kept as is by the seed)
}

type Line = [ingredient: string, grams: number, display: string];

export interface StarterRecipe {
  title: string;
  description: string;
  cuisine: string;
  mealTypes: MealType[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  lines: Line[];
  steps: string[];
}

const n = (kcal: number, proteinG: number, carbsG: number, fatG: number, fiberG: number): Nutrients => ({
  kcal,
  proteinG,
  carbsG,
  fatG,
  fiberG,
});

interface IngredientOptions {
  aliases?: string[];
  tags?: AllergenId[];
  meat?: boolean;
  fish?: boolean;
  egg?: boolean;
  dairy?: boolean;
  jain?: boolean;
  unit?: PurchaseUnit;
  pack?: number;
  perPiece?: number;
  perMl?: number;
  search?: string;
  existing?: boolean;
}

function ing(name: string, fdcId: number | null, per100g: Nutrients, aisle: AisleId, o: IngredientOptions = {}): StarterIngredient {
  return {
    name,
    aliases: o.aliases ?? [],
    fdcId,
    per100g,
    allergenTags: o.tags ?? [],
    containsMeat: o.meat ?? false,
    containsFish: o.fish ?? false,
    containsEgg: o.egg ?? false,
    containsDairy: o.dairy ?? false,
    containsHoney: false,
    jainAvoid: o.jain ?? false,
    aisle,
    purchaseUnit: o.unit ?? "g",
    packSize: o.pack ?? 500,
    gramsPerPiece: o.perPiece ?? null,
    gramsPerMl: o.perMl ?? 1,
    searchTerm: o.search ?? name,
    existing: o.existing,
  };
}

const WHEAT_GLUTEN: AllergenId[] = ["wheat-free", "gluten-free"];

export const STARTER_INGREDIENTS: StarterIngredient[] = [
  // Already in the owner's library (values copied from the database so the tests match).
  ing("ghee", 2710168, n(876, 0.28, 0, 99.48, 0), "oils", { tags: ["dairy-free"], dairy: true, unit: "ml", existing: true }),
  ing("onion", 2709795, n(38, 0.86, 8.46, 0.08, 1.7), "produce", { jain: true, existing: true }),
  ing("paneer", 2705740, n(264, 15.86, 3, 21, 0), "dairy", { tags: ["dairy-free"], dairy: true, pack: 200, existing: true }),
  ing("cumin seeds", 170923, n(428, 17.8, 44.2, 22.3, 10.5), "other", { existing: true }),
  ing("rice", 2709078, n(356, 7, 79, 0.6, 1), "grains", { existing: true }),

  // Grains
  ing("whole wheat flour", 790085, n(370, 15.1, 71.2, 2.73, 10.6), "grains", { aliases: ["atta"], tags: WHEAT_GLUTEN, pack: 1000, search: "whole wheat atta" }),
  ing("semolina", 169715, n(360, 12.7, 72.8, 1.05, 3.9), "grains", { aliases: ["sooji", "rava"], tags: WHEAT_GLUTEN, search: "sooji rava" }),
  ing("rolled oats", 2708489, n(379, 13.15, 67.7, 6.52, 10.1), "grains", { aliases: ["oats"], tags: ["gluten-free"], pack: 1000 }),
  // No USDA entry for poha: typical pack-label values (check your brand).
  ing("poha", null, n(346, 6.6, 77.3, 1.2, 2), "grains", { aliases: ["flattened rice", "rice flakes"] }),
  ing("broken wheat", 170688, n(342, 12.3, 75.9, 1.33, 12.5), "grains", { aliases: ["dalia", "bulgur"], tags: WHEAT_GLUTEN, search: "dalia broken wheat" }),
  ing("sabudana", 169717, n(358, 0.19, 88.7, 0.02, 0.9), "grains", { aliases: ["tapioca pearls"] }),
  // Many Indian breads contain milk solids and soya flour: tagged to be safe.
  ing("whole wheat bread", 172688, n(252, 12.4, 42.7, 3.5, 6), "bakery", {
    aliases: ["brown bread"],
    tags: ["wheat-free", "gluten-free", "soy-free", "dairy-free"],
    dairy: true,
    pack: 400,
  }),

  // Dals & pulses (dry weights)
  ing("toor dal", 172436, n(343, 21.7, 62.8, 1.49, 15), "pulses", { aliases: ["arhar dal", "pigeon peas"], pack: 1000 }),
  ing("moong dal", 174256, n(347, 23.9, 62.6, 1.15, 16.3), "pulses", { aliases: ["green gram"] }),
  ing("masoor dal", 174284, n(358, 23.9, 63.1, 2.17, 10.8), "pulses", { aliases: ["red lentils"] }),
  // Split bengal gram: USDA only has whole chickpeas (same values; fdc id belongs to "chickpeas").
  ing("chana dal", null, n(378, 20.5, 63, 6.04, 12.2), "pulses", { aliases: ["split bengal gram"] }),
  ing("chickpeas", 173756, n(378, 20.5, 63, 6.04, 12.2), "pulses", { aliases: ["kabuli chana", "chole"], search: "kabuli chana" }),
  ing("rajma", 173744, n(337, 22.5, 61.3, 1.06, 15.2), "pulses", { aliases: ["red kidney beans"] }),
  ing("urad dal", 174259, n(341, 25.2, 59, 1.64, 18.3), "pulses", { aliases: ["black gram"] }),
  ing("besan", 174288, n(387, 22.4, 57.8, 6.69, 10.8), "grains", { aliases: ["gram flour", "chickpea flour"] }),
  ing("moong sprouts", 169957, n(30, 3.04, 5.94, 0.18, 1.8), "produce", { aliases: ["bean sprouts"], pack: 250 }),
  ing("soya chunks", 174275, n(327, 51.5, 33.9, 1.22, 17.5), "pulses", { aliases: ["textured soy protein"], tags: ["soy-free"], pack: 200 }),
  ing("tofu", 172475, n(144, 17.3, 2.78, 8.72, 2.3), "other", { tags: ["soy-free"], pack: 200 }),

  // Dairy & eggs
  ing("curd", 171284, n(61, 3.47, 4.66, 3.25, 0), "dairy", { aliases: ["dahi", "yogurt"], tags: ["dairy-free"], dairy: true, pack: 400 }),
  ing("milk", 2705386, n(50, 3.36, 4.9, 1.9, 0), "dairy", { aliases: ["toned milk"], tags: ["dairy-free"], dairy: true, unit: "ml", perMl: 1.03, search: "toned milk" }),
  ing("butter", 173410, n(717, 0.85, 0.06, 81.1, 0), "dairy", { tags: ["dairy-free"], dairy: true, pack: 100 }),
  ing("eggs", 171287, n(143, 12.6, 0.72, 9.51, 0), "dairy", { aliases: ["egg"], tags: ["egg-free"], egg: true, unit: "piece", pack: 6, perPiece: 50 }),

  // Meat & fish
  ing("chicken breast", 171077, n(120, 22.5, 0, 2.62, 0), "meat_fish", { aliases: ["boneless chicken"], meat: true, search: "boneless chicken breast" }),
  ing("mutton", 175303, n(109, 20.6, 0, 2.31, 0), "meat_fish", { aliases: ["goat meat"], meat: true }),
  ing("fish fillet", 175176, n(96, 20.1, 0, 1.7, 0), "meat_fish", { aliases: ["basa", "tilapia"], tags: ["fish-free"], fish: true }),
  ing("prawns", 175179, n(85, 20.1, 0, 0.51, 0), "meat_fish", { aliases: ["shrimp"], tags: ["shellfish-free", "crustacean-free"], fish: true, pack: 250 }),

  // Vegetables, herbs & fruit
  ing("tomato", 170457, n(18, 0.88, 3.89, 0.2, 1.2), "produce"),
  ing("potato", 170026, n(77, 2.05, 17.5, 0.09, 2.1), "produce", { aliases: ["aloo"], jain: true, pack: 1000 }),
  ing("green peas", 170419, n(81, 5.42, 14.4, 0.4, 5.7), "produce", { aliases: ["matar"] }),
  ing("carrot", 170393, n(41, 0.93, 9.58, 0.24, 2.8), "produce", { jain: true }),
  ing("cauliflower", 169986, n(25, 1.92, 4.97, 0.28, 2), "produce", { aliases: ["gobi"], unit: "piece", pack: 1, perPiece: 600 }),
  ing("cabbage", 169975, n(25, 1.28, 5.8, 0.1, 2.5), "produce", { aliases: ["patta gobi"], unit: "piece", pack: 1, perPiece: 800 }),
  ing("capsicum", 170427, n(20, 0.86, 4.64, 0.17, 1.7), "produce", { aliases: ["green bell pepper", "shimla mirch"], pack: 250 }),
  ing("spinach", 168462, n(23, 2.86, 3.63, 0.39, 2.2), "produce", { aliases: ["palak"], pack: 250 }),
  ing("green chilli", 170497, n(40, 2, 9.46, 0.2, 1.5), "produce", { pack: 100 }),
  ing("ginger", 169231, n(80, 1.82, 17.8, 0.75, 2), "produce", { jain: true, pack: 100 }),
  ing("garlic", 169230, n(149, 6.36, 33.1, 0.5, 2.1), "produce", { jain: true, pack: 100 }),
  ing("coriander leaves", 169997, n(23, 2.13, 3.67, 0.52, 2.8), "produce", { aliases: ["dhania", "cilantro"], pack: 100 }),
  ing("mint leaves", 173475, n(44, 3.29, 8.41, 0.73, 6.8), "produce", { aliases: ["pudina"], pack: 100 }),
  ing("lemon", 2709168, n(29, 1.1, 9.32, 0.3, 2.8), "produce", { aliases: ["nimbu"], unit: "piece", pack: 4, perPiece: 60 }),
  ing("cucumber", 168409, n(15, 0.65, 3.63, 0.11, 0.5), "produce"),
  ing("okra", 169260, n(33, 1.93, 7.45, 0.19, 3.2), "produce", { aliases: ["bhindi"] }),
  ing("brinjal", 169228, n(25, 0.98, 5.88, 0.18, 3), "produce", { aliases: ["baingan", "eggplant"] }),
  ing("bottle gourd", 169232, n(14, 0.62, 3.39, 0.02, 0.5), "produce", { aliases: ["lauki", "dudhi"], pack: 1000 }),
  ing("french beans", 169961, n(31, 1.83, 6.97, 0.22, 2.7), "produce", { aliases: ["green beans"], pack: 250 }),
  ing("mushroom", 169251, n(22, 3.09, 3.26, 0.34, 1), "produce", { aliases: ["button mushroom"], jain: true, pack: 200 }),
  ing("banana", 173944, n(89, 1.09, 22.8, 0.33, 2.6), "produce", { aliases: ["kela"], unit: "piece", pack: 6, perPiece: 120 }),
  ing("fresh coconut", 170169, n(354, 3.33, 15.2, 33.5, 9), "produce", { aliases: ["grated coconut"], pack: 200 }),

  // Spices, sugar, oils
  ing("tamarind", 167763, n(239, 2.8, 62.5, 0.6, 5.1), "condiments", { aliases: ["imli"], pack: 200 }),
  ing("turmeric", 172231, n(312, 9.68, 67.1, 3.25, 22.7), "spices", { aliases: ["haldi"], pack: 100, search: "turmeric powder" }),
  ing("red chilli powder", 171319, n(282, 13.5, 49.7, 14.3, 34.8), "spices", { pack: 100 }),
  ing("coriander powder", 170922, n(298, 12.4, 55, 17.8, 41.9), "spices", { aliases: ["dhania powder"], pack: 100 }),
  ing("mustard seeds", 170929, n(508, 26.1, 28.1, 36.2, 12.2), "spices", { aliases: ["rai"], tags: ["mustard-free"], pack: 100 }),
  ing("black pepper", 170931, n(251, 10.4, 64, 3.26, 25.3), "spices", { pack: 100 }),
  ing("salt", 173468, n(0, 0, 0, 0, 0), "spices", { pack: 1000 }),
  ing("sugar", 169655, n(387, 0, 100, 0, 0), "other", { pack: 1000 }),
  // USDA has no jaggery; brown sugar is the closest match.
  ing("jaggery", 168833, n(380, 0.12, 98.1, 0, 0), "other", { aliases: ["gur"] }),
  ing("sunflower oil", 171025, n(884, 0, 0, 100, 0), "oils", { aliases: ["cooking oil"], unit: "ml", pack: 1000, perMl: 0.92 }),

  // Nuts, dry fruit & sauces
  ing("peanuts", 172430, n(567, 25.8, 16.1, 49.2, 8.5), "snacks", { aliases: ["groundnuts", "moongphali"], tags: ["peanut-free"] }),
  ing("cashews", 170162, n(553, 18.2, 30.2, 43.8, 3.3), "snacks", { aliases: ["kaju"], tags: ["tree-nut-free"], pack: 200 }),
  ing("almonds", 170567, n(579, 21.2, 21.6, 49.9, 12.5), "snacks", { aliases: ["badam"], tags: ["tree-nut-free"], pack: 200 }),
  ing("raisins", 168165, n(299, 3.3, 79.3, 0.25, 4.5), "snacks", { aliases: ["kishmish"], tags: ["sulfite-free"], pack: 200 }),
  ing("peanut butter", 172470, n(598, 22.2, 22.3, 51.4, 5), "condiments", { tags: ["peanut-free"], pack: 350 }),
  ing("soy sauce", 174277, n(53, 8.14, 4.93, 0.57, 0.8), "condiments", {
    tags: ["soy-free", "wheat-free", "gluten-free"],
    unit: "ml",
    pack: 200,
    perMl: 1.2,
  }),
];

const BOTH: MealType[] = ["lunch", "dinner"];
const BREAKFAST: MealType[] = ["breakfast"];

// Common step for dishes served with roti.
const ROTI_STEP =
  "For the rotis: knead the atta with a pinch of salt and enough water into a soft dough, rest 15 minutes, roll thin and cook on a hot tawa until puffed.";

export const STARTER_RECIPES: StarterRecipe[] = [
  // ---------------------------------------------------------------- breakfast
  {
    title: "Vegetable Poha",
    description: "Soft flattened rice with potato, peas and peanuts, finished with lemon.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 15,
    lines: [
      ["poha", 120, "1½ cups"], ["onion", 60, "1 small"], ["potato", 80, "1 small"], ["green peas", 40, "¼ cup"],
      ["peanuts", 20, "2 tbsp"], ["sunflower oil", 15, "1 tbsp"], ["mustard seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["green chilli", 5, "1"], ["lemon", 30, "½"], ["coriander leaves", 5, "2 tbsp"], ["salt", 3, "½ tsp"], ["sugar", 5, "1 tsp"],
    ],
    steps: [
      "Rinse the poha in a sieve under running water, drain and leave 5 minutes to soften.",
      "Heat the oil, add mustard seeds; when they splutter add the peanuts and fry 1 minute.",
      "Add chopped onion, green chilli and diced potato; cover and cook 6–8 minutes until the potato is soft.",
      "Stir in peas, turmeric, salt and sugar, then the poha. Mix gently and heat through for 2 minutes.",
      "Squeeze over the lemon and scatter the coriander.",
    ],
  },
  {
    title: "Jain Poha",
    description: "Poha without onion or potato — peas, capsicum and peanuts instead.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 12,
    lines: [
      ["poha", 120, "1½ cups"], ["green peas", 50, "⅓ cup"], ["capsicum", 50, "½"], ["peanuts", 20, "2 tbsp"],
      ["sunflower oil", 15, "1 tbsp"], ["mustard seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["green chilli", 5, "1"],
      ["lemon", 30, "½"], ["coriander leaves", 5, "2 tbsp"], ["salt", 3, "½ tsp"], ["sugar", 5, "1 tsp"],
    ],
    steps: [
      "Rinse the poha, drain and leave 5 minutes to soften.",
      "Heat the oil, splutter the mustard seeds, then fry the peanuts for 1 minute.",
      "Add green chilli, capsicum and peas; cook 4 minutes.",
      "Add turmeric, salt, sugar and the poha; mix gently and heat 2 minutes. Finish with lemon and coriander.",
    ],
  },
  {
    title: "Vegetable Upma",
    description: "Roasted semolina cooked with vegetables and a mustard-seed tempering.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 15,
    lines: [
      ["semolina", 100, "⅔ cup"], ["onion", 50, "1 small"], ["carrot", 40, "½"], ["green peas", 30, "3 tbsp"],
      ["sunflower oil", 15, "1 tbsp"], ["mustard seeds", 2, "½ tsp"], ["green chilli", 5, "1"], ["ginger", 5, "1 tsp grated"],
      ["salt", 3, "½ tsp"], ["coriander leaves", 5, "2 tbsp"],
    ],
    steps: [
      "Dry-roast the semolina in a pan for 4–5 minutes until fragrant; set aside.",
      "Heat the oil, splutter the mustard seeds, then add onion, ginger and green chilli and cook 2 minutes.",
      "Add the carrot and peas and cook 3 minutes. Pour in 500 ml water with the salt and bring to a boil.",
      "Lower the heat and pour in the semolina slowly, stirring all the time. Cover for 2–3 minutes, then fluff and add coriander.",
    ],
  },
  {
    title: "Jain Vegetable Upma",
    description: "Upma with capsicum, tomato, peas and cashews — no onion, ginger or roots.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 15,
    lines: [
      ["semolina", 100, "⅔ cup"], ["capsicum", 40, "⅓"], ["tomato", 50, "1 small"], ["green peas", 30, "3 tbsp"],
      ["cashews", 10, "6–8"], ["sunflower oil", 15, "1 tbsp"], ["mustard seeds", 2, "½ tsp"], ["green chilli", 5, "1"],
      ["salt", 3, "½ tsp"], ["coriander leaves", 5, "2 tbsp"],
    ],
    steps: [
      "Dry-roast the semolina for 4–5 minutes until fragrant; set aside.",
      "Heat the oil, splutter the mustard seeds, fry the cashews golden, then add green chilli, capsicum, tomato and peas for 3 minutes.",
      "Add 500 ml water and the salt; bring to a boil.",
      "Pour in the semolina slowly while stirring, cover 2–3 minutes, then fluff and add coriander.",
    ],
  },
  {
    title: "Masala Oats",
    description: "Savoury oats cooked with vegetables and Indian spices.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 5, cookMinutes: 12,
    lines: [
      ["rolled oats", 100, "1 cup"], ["onion", 40, "½"], ["tomato", 60, "1 small"], ["carrot", 30, "¼"],
      ["green peas", 30, "3 tbsp"], ["sunflower oil", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["red chilli powder", 1, "¼ tsp"], ["salt", 3, "½ tsp"], ["coriander leaves", 5, "2 tbsp"],
    ],
    steps: [
      "Heat the oil, add cumin seeds, then onion; cook 2 minutes.",
      "Add tomato, carrot and peas with turmeric, chilli powder and salt; cook 4 minutes.",
      "Add the oats and 400 ml water. Simmer 4–5 minutes, stirring, until creamy. Top with coriander.",
    ],
  },
  {
    title: "Banana Oats Porridge",
    description: "Oats simmered in milk with banana, almonds and a little jaggery.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 5, cookMinutes: 8,
    lines: [
      ["rolled oats", 80, "¾ cup"], ["milk", 400, "1⅔ cups"], ["banana", 120, "1"], ["almonds", 15, "10–12"],
      ["jaggery", 10, "2 tsp"],
    ],
    steps: [
      "Bring the milk to a simmer, add the oats and cook 4–5 minutes, stirring.",
      "Stir in the jaggery until it melts.",
      "Serve topped with sliced banana and chopped almonds.",
    ],
  },
  {
    title: "Moong Dal Chilla",
    description: "Protein-rich savoury pancakes from soaked yellow moong dal.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 15, cookMinutes: 15,
    lines: [
      ["moong dal", 120, "¾ cup (dry)"], ["tomato", 40, "½"], ["green chilli", 5, "1"], ["coriander leaves", 5, "2 tbsp"],
      ["cumin seeds", 2, "½ tsp"], ["sunflower oil", 15, "1 tbsp"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Soak the moong dal 3–4 hours, drain and grind with green chilli and a little water to a smooth, pourable batter.",
      "Stir in salt, cumin, chopped tomato and coriander.",
      "Spread a ladle of batter thinly on a hot greased tawa, drizzle oil around and cook until golden on both sides.",
    ],
  },
  {
    title: "Besan Chilla",
    description: "Quick gram-flour pancakes with onion, tomato and coriander.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 15,
    lines: [
      ["besan", 100, "1 cup"], ["onion", 40, "½"], ["tomato", 50, "1 small"], ["green chilli", 5, "1"],
      ["coriander leaves", 5, "2 tbsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"],
      ["sunflower oil", 15, "1 tbsp"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Whisk the besan with about 180 ml water, turmeric, chilli powder and salt into a smooth batter.",
      "Stir in finely chopped onion, tomato, green chilli and coriander.",
      "Pour a ladleful onto a hot greased tawa, spread thin and cook 2 minutes per side with a little oil.",
    ],
  },
  {
    title: "Idli with Coconut Chutney",
    description: "Steamed rice-and-urad-dal cakes with fresh coconut chutney.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 3, prepMinutes: 20, cookMinutes: 15,
    lines: [
      ["rice", 150, "¾ cup"], ["urad dal", 50, "¼ cup"], ["fresh coconut", 60, "½ cup grated"], ["green chilli", 5, "1"],
      ["mustard seeds", 2, "½ tsp"], ["sunflower oil", 5, "1 tsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak rice and urad dal separately for 5 hours. Grind each smoothly, mix with salt and leave to ferment overnight.",
      "Pour the batter into greased idli moulds and steam 10–12 minutes.",
      "For the chutney, grind the coconut with green chilli, a pinch of salt and a little water.",
      "Temper with mustard seeds spluttered in the oil and pour over the chutney.",
    ],
  },
  {
    title: "Plain Dosa with Coconut Chutney",
    description: "Crisp fermented rice-and-lentil crêpes with coconut chutney.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 3, prepMinutes: 20, cookMinutes: 20,
    lines: [
      ["rice", 150, "¾ cup"], ["urad dal", 50, "¼ cup"], ["sunflower oil", 20, "4 tsp"], ["fresh coconut", 60, "½ cup grated"],
      ["green chilli", 5, "1"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak rice and urad dal 5 hours, grind to a smooth batter with salt and ferment overnight.",
      "Spread a ladle of batter in a thin circle on a very hot tawa, drizzle oil and cook until crisp and golden.",
      "Grind the coconut with green chilli, salt and a little water for the chutney.",
    ],
  },
  {
    title: "Masala Dosa",
    description: "Crisp dosa filled with a turmeric potato-onion masala.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 3, prepMinutes: 20, cookMinutes: 30,
    lines: [
      ["rice", 150, "¾ cup"], ["urad dal", 50, "¼ cup"], ["potato", 250, "2 medium"], ["onion", 60, "1 small"],
      ["sunflower oil", 25, "5 tsp"], ["mustard seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["green chilli", 5, "1"],
      ["salt", 5, "1 tsp"],
    ],
    steps: [
      "Make and ferment the dosa batter as for plain dosa (soak 5 hours, grind with salt, rest overnight).",
      "Boil and roughly mash the potatoes.",
      "Heat 1 tbsp oil, splutter mustard seeds, add onion and green chilli, then turmeric, potatoes and a splash of water; cook 3 minutes.",
      "Cook thin dosas on a hot tawa with a little oil, fill with the potato masala and fold.",
    ],
  },
  {
    title: "Pesarattu (Green Moong Dosa)",
    description: "Andhra-style dosa made from moong dal — no fermenting needed.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 15, cookMinutes: 15,
    lines: [
      ["moong dal", 150, "¾ cup (dry)"], ["rice", 30, "2 tbsp"], ["ginger", 5, "1 tsp"], ["green chilli", 5, "1"],
      ["onion", 40, "½"], ["sunflower oil", 15, "1 tbsp"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Soak moong dal and rice for 4 hours. Grind with ginger, green chilli and salt to a smooth batter.",
      "Spread thin on a hot tawa, sprinkle chopped onion, drizzle oil and cook until crisp.",
    ],
  },
  {
    title: "Aloo Paratha with Curd",
    description: "Whole-wheat flatbreads stuffed with spiced potato, served with curd.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 20, cookMinutes: 20,
    lines: [
      ["whole wheat flour", 150, "1¼ cups"], ["potato", 200, "2 medium"], ["green chilli", 5, "1"],
      ["coriander leaves", 5, "2 tbsp"], ["red chilli powder", 1, "¼ tsp"], ["ghee", 15, "1 tbsp"], ["curd", 150, "⅔ cup"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Knead the atta with a pinch of salt and water into a soft dough; rest 15 minutes.",
      "Boil and mash the potatoes with green chilli, coriander, chilli powder and salt.",
      "Stuff a ball of filling into each dough ball, seal and roll out gently.",
      "Cook on a hot tawa with a little ghee until golden on both sides. Serve with curd.",
    ],
  },
  {
    title: "Paneer Paratha",
    description: "Whole-wheat parathas stuffed with crumbled spiced paneer.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 20, cookMinutes: 15,
    lines: [
      ["whole wheat flour", 150, "1¼ cups"], ["paneer", 100, "½ cup crumbled"], ["green chilli", 5, "1"],
      ["coriander leaves", 5, "2 tbsp"], ["ghee", 15, "1 tbsp"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Knead the atta with water into a soft dough; rest 15 minutes.",
      "Mix the crumbled paneer with chopped green chilli, coriander and salt.",
      "Stuff, seal and roll the parathas, then cook on a hot tawa with a little ghee until golden.",
    ],
  },
  {
    title: "Gobi Paratha with Curd",
    description: "Parathas stuffed with grated cauliflower, ginger and green chilli.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 20, cookMinutes: 20,
    lines: [
      ["whole wheat flour", 150, "1¼ cups"], ["cauliflower", 150, "1½ cups grated"], ["green chilli", 5, "1"],
      ["ginger", 5, "1 tsp grated"], ["coriander leaves", 5, "2 tbsp"], ["ghee", 15, "1 tbsp"], ["curd", 150, "⅔ cup"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Knead the atta into a soft dough and rest 15 minutes.",
      "Mix grated cauliflower with salt, leave 5 minutes, squeeze out the water, then add ginger, chilli and coriander.",
      "Stuff, roll and cook the parathas on a hot tawa with a little ghee. Serve with curd.",
    ],
  },
  {
    title: "Mint Chutney Vegetable Sandwich",
    description: "Whole-wheat sandwich with fresh mint-coriander chutney, cucumber, tomato and capsicum.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 15, cookMinutes: 0,
    lines: [
      ["whole wheat bread", 160, "6 slices"], ["butter", 10, "2 tsp"], ["cucumber", 60, "½"], ["tomato", 60, "1 small"],
      ["capsicum", 30, "¼"], ["mint leaves", 5, "¼ cup"], ["coriander leaves", 10, "½ cup"], ["green chilli", 3, "½"],
      ["lemon", 10, "a squeeze"], ["black pepper", 1, "a pinch"], ["salt", 2, "a pinch"],
    ],
    steps: [
      "Grind mint, coriander, green chilli, lemon and salt with a spoon of water into a thick chutney.",
      "Butter the bread and spread with the chutney.",
      "Layer thinly sliced cucumber, tomato and capsicum, season with pepper, close and cut.",
    ],
  },
  {
    title: "Peanut Butter Banana Toast",
    description: "Whole-wheat toast with peanut butter and sliced banana.",
    cuisine: "international", mealTypes: BREAKFAST, servings: 1, prepMinutes: 5, cookMinutes: 3,
    lines: [["whole wheat bread", 80, "2 slices"], ["peanut butter", 32, "2 tbsp"], ["banana", 120, "1"]],
    steps: ["Toast the bread.", "Spread with peanut butter and top with sliced banana."],
  },
  {
    title: "Egg Bhurji with Toast",
    description: "Indian-style scrambled eggs with onion, tomato and green chilli.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 5, cookMinutes: 10,
    lines: [
      ["eggs", 200, "4"], ["onion", 50, "1 small"], ["tomato", 60, "1 small"], ["green chilli", 5, "1"],
      ["turmeric", 1, "¼ tsp"], ["sunflower oil", 10, "2 tsp"], ["coriander leaves", 5, "2 tbsp"], ["salt", 3, "½ tsp"],
      ["whole wheat bread", 120, "4 slices"],
    ],
    steps: [
      "Heat the oil, cook onion and green chilli 2 minutes, then tomato, turmeric and salt for 2 minutes.",
      "Pour in the beaten eggs and stir gently over low heat until just set.",
      "Scatter coriander and serve with toast.",
    ],
  },
  {
    title: "Masala Omelette",
    description: "Fluffy three-egg omelette with onion, tomato and chilli.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 1, prepMinutes: 5, cookMinutes: 5,
    lines: [
      ["eggs", 150, "3"], ["onion", 40, "½"], ["tomato", 40, "½"], ["green chilli", 5, "1"], ["coriander leaves", 5, "2 tbsp"],
      ["sunflower oil", 10, "2 tsp"], ["salt", 2, "a pinch"], ["black pepper", 1, "a pinch"],
    ],
    steps: [
      "Beat the eggs with salt, pepper and the chopped vegetables and coriander.",
      "Pour into a hot oiled pan, cook until the base sets, then fold or flip and cook 1 more minute.",
    ],
  },
  {
    title: "Moong Sprouts Salad",
    description: "Crunchy sprouted moong with vegetables, peanuts and lemon.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 1, prepMinutes: 10, cookMinutes: 3,
    lines: [
      ["moong sprouts", 200, "2 cups"], ["onion", 40, "½"], ["tomato", 60, "1 small"], ["cucumber", 60, "½"],
      ["peanuts", 30, "3 tbsp roasted"], ["lemon", 30, "½"], ["coriander leaves", 5, "2 tbsp"], ["green chilli", 3, "½"],
      ["salt", 2, "a pinch"],
    ],
    steps: [
      "Steam or blanch the sprouts for 2–3 minutes and cool.",
      "Toss with the chopped vegetables, green chilli, peanuts, salt, lemon juice and coriander.",
    ],
  },
  {
    title: "Sabudana Khichdi",
    description: "Tapioca pearls with peanuts, potato and cumin — a Maharashtrian favourite.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 15,
    lines: [
      ["sabudana", 150, "1 cup"], ["peanuts", 40, "¼ cup roasted"], ["potato", 100, "1"], ["green chilli", 5, "1"],
      ["cumin seeds", 2, "½ tsp"], ["ghee", 10, "2 tsp"], ["lemon", 15, "¼"], ["coriander leaves", 5, "2 tbsp"],
      ["salt", 3, "½ tsp"], ["sugar", 5, "1 tsp"],
    ],
    steps: [
      "Rinse the sabudana, soak overnight in just enough water to cover, and drain.",
      "Coarsely crush the peanuts and mix with the sabudana, salt and sugar.",
      "Heat the ghee, add cumin, green chilli and diced boiled potato; cook 2 minutes.",
      "Add the sabudana mix and cook on low heat 5–6 minutes, stirring, until the pearls turn translucent. Finish with lemon and coriander.",
    ],
  },
  {
    title: "Vegetable Dalia",
    description: "Savoury broken wheat cooked with vegetables — filling and high in fibre.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 20,
    lines: [
      ["broken wheat", 100, "½ cup"], ["onion", 40, "½"], ["carrot", 40, "½"], ["green peas", 40, "¼ cup"],
      ["tomato", 50, "1 small"], ["sunflower oil", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["salt", 3, "½ tsp"], ["coriander leaves", 5, "2 tbsp"],
    ],
    steps: [
      "Dry-roast the dalia for 3 minutes.",
      "Heat the oil in a pressure cooker, add cumin and onion, then the vegetables, turmeric and salt.",
      "Add the dalia and 500 ml water; pressure-cook for 3 whistles. Garnish with coriander.",
    ],
  },
  {
    title: "Sweet Dalia with Milk",
    description: "Broken wheat porridge cooked in milk with jaggery, almonds and raisins.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 5, cookMinutes: 20,
    lines: [
      ["broken wheat", 80, "⅓ cup"], ["milk", 400, "1⅔ cups"], ["jaggery", 25, "2 tbsp"], ["almonds", 10, "6–8"],
      ["raisins", 15, "1 tbsp"],
    ],
    steps: [
      "Roast the dalia for 3 minutes, add 250 ml water and cook until soft (about 10 minutes).",
      "Add the milk and simmer 5 minutes, then stir in the jaggery off the heat.",
      "Top with chopped almonds and raisins.",
    ],
  },
  {
    title: "Onion Tomato Uttapam",
    description: "Thick dosa-batter pancakes topped with onion, tomato and capsicum.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 3, prepMinutes: 20, cookMinutes: 20,
    lines: [
      ["rice", 150, "¾ cup"], ["urad dal", 50, "¼ cup"], ["onion", 60, "1 small"], ["tomato", 60, "1 small"],
      ["capsicum", 40, "⅓"], ["green chilli", 5, "1"], ["coriander leaves", 5, "2 tbsp"], ["sunflower oil", 20, "4 tsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Make and ferment dosa batter (soak rice and urad dal 5 hours, grind with salt, rest overnight).",
      "Pour a thick circle of batter onto a hot tawa and press the chopped vegetables and coriander on top.",
      "Drizzle oil around, cook until the base is golden, flip and cook 1–2 minutes more.",
    ],
  },
  {
    title: "Tofu Bhurji",
    description: "A vegan take on egg bhurji with crumbled tofu and vegetables.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 10, cookMinutes: 10,
    lines: [
      ["tofu", 300, "1½ blocks"], ["onion", 50, "1 small"], ["tomato", 60, "1 small"], ["capsicum", 40, "⅓"],
      ["green chilli", 5, "1"], ["turmeric", 1, "¼ tsp"], ["sunflower oil", 10, "2 tsp"], ["coriander leaves", 5, "2 tbsp"],
      ["salt", 2, "a pinch"],
    ],
    steps: [
      "Heat the oil, cook onion, green chilli and capsicum for 3 minutes, then add tomato, turmeric and salt.",
      "Crumble in the tofu and cook 4–5 minutes, stirring. Finish with coriander.",
    ],
  },
  {
    title: "Chickpea Chaat",
    description: "Tangy boiled chickpeas with onion, tomato, cucumber and lemon.",
    cuisine: "indian", mealTypes: ["breakfast", "lunch"], servings: 2, prepMinutes: 10, cookMinutes: 30,
    lines: [
      ["chickpeas", 140, "¾ cup (dry)"], ["onion", 40, "½"], ["tomato", 60, "1 small"], ["cucumber", 50, "½"],
      ["lemon", 20, "⅓"], ["coriander leaves", 5, "2 tbsp"], ["green chilli", 3, "½"], ["cumin seeds", 1, "¼ tsp roasted"],
      ["salt", 2, "a pinch"],
    ],
    steps: [
      "Soak the chickpeas overnight and pressure-cook with salt until soft (5–6 whistles). Drain and cool.",
      "Toss with the chopped vegetables, green chilli, crushed roasted cumin, lemon juice and coriander.",
    ],
  },
  {
    title: "Masala Thepla with Curd",
    description: "Soft Gujarati spiced flatbreads made with atta, besan and curd.",
    cuisine: "indian", mealTypes: BREAKFAST, servings: 2, prepMinutes: 20, cookMinutes: 20,
    lines: [
      ["whole wheat flour", 150, "1¼ cups"], ["besan", 30, "¼ cup"], ["curd", 160, "⅔ cup"], ["turmeric", 1, "¼ tsp"],
      ["red chilli powder", 1, "¼ tsp"], ["coriander leaves", 10, "¼ cup"], ["sunflower oil", 15, "1 tbsp"],
      ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Mix the atta, besan, spices, salt, chopped coriander, 1 tsp oil and 60 g of the curd; knead to a soft dough with water.",
      "Roll into thin circles and cook on a hot tawa with a little oil until spotted golden.",
      "Serve with the rest of the curd.",
    ],
  },
  {
    title: "Banana Peanut Butter Smoothie",
    description: "Milk, banana, oats and peanut butter blended into a filling breakfast drink.",
    cuisine: "international", mealTypes: BREAKFAST, servings: 1, prepMinutes: 5, cookMinutes: 0,
    lines: [["milk", 300, "1¼ cups"], ["banana", 120, "1"], ["rolled oats", 30, "⅓ cup"], ["peanut butter", 16, "1 tbsp"]],
    steps: ["Blend everything until smooth. Add a few ice cubes if you like it cold."],
  },

  // ---------------------------------------------------------------- lunch & dinner
  {
    title: "Dal Tadka with Rice",
    description: "Toor dal finished with a garlic-cumin ghee tadka, served with steamed rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 30,
    lines: [
      ["toor dal", 100, "½ cup"], ["rice", 120, "⅔ cup"], ["onion", 50, "1 small"], ["tomato", 80, "1"], ["garlic", 6, "2 cloves"],
      ["ghee", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"],
      ["coriander leaves", 5, "2 tbsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Pressure-cook the rinsed dal with turmeric, salt and 400 ml water for 4 whistles; whisk smooth.",
      "Cook the rice in 2 cups water until tender.",
      "Heat the ghee, add cumin and garlic, then onion, tomato and chilli powder; cook 5 minutes and pour into the dal.",
      "Simmer 3 minutes and garnish with coriander. Serve with the rice.",
    ],
  },
  {
    title: "Jain Dal with Jeera Rice",
    description: "Tomato toor dal without onion or garlic, with cumin rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 30,
    lines: [
      ["toor dal", 100, "½ cup"], ["rice", 120, "⅔ cup"], ["tomato", 80, "1"], ["ghee", 15, "1 tbsp"], ["cumin seeds", 4, "1 tsp"],
      ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"], ["coriander leaves", 5, "2 tbsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Pressure-cook the dal with turmeric, salt and 400 ml water for 4 whistles; whisk smooth.",
      "Heat half the ghee, add half the cumin, then tomato and chilli powder; cook 3 minutes and add to the dal.",
      "For the rice, fry the rest of the cumin in the rest of the ghee, add rice and 2 cups water and cook until tender.",
    ],
  },
  {
    title: "Rajma Chawal",
    description: "Punjabi kidney-bean curry with steamed rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 45,
    lines: [
      ["rajma", 100, "½ cup (dry)"], ["rice", 120, "⅔ cup"], ["onion", 80, "1"], ["tomato", 120, "2 small"], ["ginger", 8, "2 tsp"],
      ["garlic", 8, "3 cloves"], ["sunflower oil", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["coriander powder", 3, "1 tsp"],
      ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the rajma overnight, then pressure-cook with salt and fresh water for 6–7 whistles until very soft.",
      "Heat the oil, add cumin, then onion; fry golden. Add ginger, garlic, tomato and spices and cook until the oil separates.",
      "Add the rajma with its liquid and simmer 15 minutes, mashing a few beans to thicken. Serve with rice.",
    ],
  },
  {
    title: "Chole with Roti",
    description: "Spiced chickpea curry with whole-wheat rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 45,
    lines: [
      ["chickpeas", 100, "½ cup (dry)"], ["whole wheat flour", 120, "1 cup"], ["onion", 80, "1"], ["tomato", 120, "2 small"],
      ["ginger", 8, "2 tsp"], ["garlic", 8, "3 cloves"], ["sunflower oil", 15, "1 tbsp"], ["coriander powder", 3, "1 tsp"],
      ["red chilli powder", 2, "½ tsp"], ["cumin seeds", 2, "½ tsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the chickpeas overnight and pressure-cook with salt for 5–6 whistles.",
      "Fry cumin and onion in the oil until golden; add ginger, garlic, tomato and spices and cook 8 minutes.",
      "Add the chickpeas and some cooking water; simmer 15 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Jain Chole with Roti",
    description: "Chickpea curry with tomato and spices — no onion, garlic or ginger.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 45,
    lines: [
      ["chickpeas", 100, "½ cup (dry)"], ["whole wheat flour", 120, "1 cup"], ["tomato", 150, "2"], ["sunflower oil", 15, "1 tbsp"],
      ["cumin seeds", 2, "½ tsp"], ["coriander powder", 4, "1½ tsp"], ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["lemon", 15, "¼"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the chickpeas overnight and pressure-cook with salt for 5–6 whistles.",
      "Heat the oil, add cumin, then pureed tomato and the spices; cook until thick.",
      "Add the chickpeas and some cooking water, simmer 15 minutes and finish with lemon.",
      ROTI_STEP,
    ],
  },
  {
    title: "Palak Paneer with Roti",
    description: "Paneer cubes in a smooth garlicky spinach gravy, with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["spinach", 250, "1 bunch"], ["paneer", 150, "1 cup cubed"], ["onion", 60, "1 small"], ["tomato", 60, "1 small"],
      ["garlic", 6, "2 cloves"], ["ginger", 6, "1 tsp"], ["sunflower oil", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Blanch the spinach 2 minutes, cool in cold water and blend smooth.",
      "Heat the oil, add cumin, onion, ginger and garlic; cook 3 minutes, then tomato for 3 minutes.",
      "Add the spinach puree and salt, simmer 5 minutes, then add the paneer and heat through.",
      ROTI_STEP,
    ],
  },
  {
    title: "Jain Palak Paneer with Roti",
    description: "Spinach and paneer cooked with tomato and cumin — no onion, garlic or ginger.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["spinach", 250, "1 bunch"], ["paneer", 150, "1 cup cubed"], ["tomato", 80, "1"], ["ghee", 10, "2 tsp"],
      ["cumin seeds", 2, "½ tsp"], ["green chilli", 5, "1"], ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Blanch the spinach with the green chilli, cool and blend smooth.",
      "Heat the ghee, add cumin and chopped tomato; cook 4 minutes.",
      "Add the spinach and salt, simmer 5 minutes, then add paneer and heat through.",
      ROTI_STEP,
    ],
  },
  {
    title: "Matar Paneer with Roti",
    description: "Peas and paneer in an onion-tomato gravy, with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["green peas", 120, "¾ cup"], ["paneer", 120, "¾ cup cubed"], ["onion", 60, "1 small"], ["tomato", 120, "2 small"],
      ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"], ["sunflower oil", 12, "1 tbsp"], ["coriander powder", 3, "1 tsp"],
      ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Blend onion, tomato, ginger and garlic into a paste.",
      "Cook the paste in the oil with the spices until thick and the oil separates (8–10 minutes).",
      "Add peas and 200 ml water, simmer 8 minutes, then add paneer and simmer 3 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Aloo Gobi with Roti",
    description: "Dry potato and cauliflower sabzi with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["potato", 200, "2 medium"], ["cauliflower", 250, "½ head"], ["onion", 50, "1 small"], ["tomato", 80, "1"],
      ["ginger", 6, "1 tsp"], ["sunflower oil", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["coriander powder", 3, "1 tsp"], ["red chilli powder", 1, "¼ tsp"], ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Heat the oil, add cumin, onion and ginger; cook 2 minutes.",
      "Add cubed potato, cauliflower florets, spices and salt; cover and cook on low heat 15 minutes, stirring now and then.",
      "Add chopped tomato and cook uncovered 5 minutes more.",
      ROTI_STEP,
    ],
  },
  {
    title: "Bhindi Masala with Roti",
    description: "Stir-fried okra with onion, tomato and spices, with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["okra", 250, "2 cups sliced"], ["onion", 80, "1"], ["tomato", 80, "1"], ["sunflower oil", 15, "1 tbsp"],
      ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["coriander powder", 3, "1 tsp"], ["red chilli powder", 2, "½ tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Wash and fully dry the okra before slicing (this stops it going slimy).",
      "Fry the okra in the oil on medium-high heat for 8 minutes until lightly browned; push aside.",
      "Add cumin and onion, cook 3 minutes, then tomato, spices and salt; toss everything together for 3 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Jain Bhindi with Roti",
    description: "Okra stir-fried with tomato and dry spices — Jain friendly.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["okra", 250, "2 cups sliced"], ["tomato", 100, "1 large"], ["sunflower oil", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"],
      ["turmeric", 1, "¼ tsp"], ["coriander powder", 4, "1½ tsp"], ["red chilli powder", 2, "½ tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Dry the okra well, slice, and fry in the oil for 8 minutes until lightly browned.",
      "Add cumin, chopped tomato, spices and salt; cook 4 minutes, tossing.",
      ROTI_STEP,
    ],
  },
  {
    title: "Baingan Bharta with Roti",
    description: "Smoky roasted brinjal mashed with onion, tomato and garlic.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 30,
    lines: [
      ["brinjal", 400, "1 large"], ["onion", 80, "1"], ["tomato", 120, "2 small"], ["garlic", 8, "3 cloves"], ["green chilli", 5, "1"],
      ["sunflower oil", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["red chilli powder", 1, "¼ tsp"],
      ["coriander leaves", 5, "2 tbsp"], ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Roast the brinjal directly over a gas flame, turning, until charred and soft (10–12 minutes). Cool, peel and mash.",
      "Fry cumin, garlic, green chilli and onion in the oil until soft, then tomato and chilli powder for 4 minutes.",
      "Add the mashed brinjal and salt and cook 5 minutes. Garnish with coriander.",
      ROTI_STEP,
    ],
  },
  {
    title: "Lauki Chana Dal with Rice",
    description: "Bottle gourd and chana dal cooked together — light, Jain friendly and vegan.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 30,
    lines: [
      ["bottle gourd", 250, "2 cups cubed"], ["chana dal", 80, "⅓ cup"], ["tomato", 60, "1 small"], ["sunflower oil", 10, "2 tsp"],
      ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"], ["rice", 120, "⅔ cup"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the chana dal 1 hour.",
      "Heat the oil, add cumin and tomato, then the lauki, dal, spices, salt and 400 ml water.",
      "Pressure-cook for 3 whistles. Serve with rice cooked in 2 cups water.",
    ],
  },
  {
    title: "Mixed Vegetable Sabzi with Roti",
    description: "Seasonal vegetables in a light onion-tomato masala, with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["carrot", 80, "1"], ["french beans", 80, "¾ cup"], ["green peas", 80, "½ cup"], ["cauliflower", 120, "1 cup"],
      ["potato", 100, "1"], ["onion", 60, "1 small"], ["tomato", 80, "1"], ["sunflower oil", 15, "1 tbsp"],
      ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["coriander powder", 3, "1 tsp"], ["red chilli powder", 1, "¼ tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Heat the oil, add cumin and onion and cook 3 minutes, then tomato and spices for 3 minutes.",
      "Add the chopped vegetables, salt and a splash of water; cover and cook 12–15 minutes until tender.",
      ROTI_STEP,
    ],
  },
  {
    title: "Jain Mixed Vegetable with Roti",
    description: "Beans, peas, cauliflower, capsicum and cabbage — no onion, garlic or roots.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["french beans", 100, "1 cup"], ["green peas", 80, "½ cup"], ["cauliflower", 150, "1½ cups"], ["capsicum", 80, "¾"],
      ["cabbage", 100, "1 cup shredded"], ["tomato", 80, "1"], ["sunflower oil", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"],
      ["turmeric", 1, "¼ tsp"], ["coriander powder", 3, "1 tsp"], ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Heat the oil, add cumin, then tomato and spices; cook 3 minutes.",
      "Add the vegetables and salt, cover and cook 12 minutes until tender.",
      ROTI_STEP,
    ],
  },
  {
    title: "Cabbage Peas Sabzi with Roti",
    description: "Quick patta gobi matar with a mustard-seed tempering.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 15,
    lines: [
      ["cabbage", 300, "3 cups shredded"], ["green peas", 100, "⅔ cup"], ["sunflower oil", 12, "1 tbsp"],
      ["mustard seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["green chilli", 5, "1"], ["whole wheat flour", 120, "1 cup"],
      ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Heat the oil, splutter the mustard seeds, add green chilli and turmeric.",
      "Add cabbage, peas and salt; cover and cook 10 minutes, stirring once or twice.",
      ROTI_STEP,
    ],
  },
  {
    title: "Kadhi Chawal",
    description: "Tangy curd and besan kadhi with steamed rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 30,
    lines: [
      ["besan", 50, "½ cup"], ["curd", 300, "1¼ cups"], ["rice", 120, "⅔ cup"], ["ghee", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"],
      ["mustard seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["green chilli", 5, "1"], ["red chilli powder", 1, "¼ tsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Whisk the curd, besan, turmeric, salt and 500 ml water until smooth.",
      "Heat the ghee, splutter mustard and cumin seeds, add green chilli, then pour in the curd mix.",
      "Bring to a boil while stirring, then simmer 20 minutes until thickened. Add chilli powder and serve with rice.",
    ],
  },
  {
    title: "Curd Rice",
    description: "South Indian comfort food: rice mixed with curd and tempered with mustard seeds.",
    cuisine: "indian", mealTypes: ["lunch"], servings: 2, prepMinutes: 10, cookMinutes: 20,
    lines: [
      ["rice", 120, "⅔ cup"], ["curd", 300, "1¼ cups"], ["cucumber", 60, "½"], ["mustard seeds", 2, "½ tsp"],
      ["green chilli", 5, "1"], ["sunflower oil", 8, "2 tsp"], ["coriander leaves", 5, "2 tbsp"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Cook the rice until very soft and let it cool.",
      "Mash lightly and mix in the curd, salt and grated cucumber.",
      "Temper mustard seeds and green chilli in the oil and pour over. Garnish with coriander.",
    ],
  },
  {
    title: "Vegetable Pulao with Raita",
    description: "Fragrant ghee rice with vegetables and cucumber raita.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["rice", 150, "¾ cup"], ["carrot", 50, "½"], ["french beans", 50, "½ cup"], ["green peas", 60, "⅓ cup"], ["onion", 60, "1 small"],
      ["ghee", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["curd", 150, "⅔ cup"], ["cucumber", 60, "½"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the rice 20 minutes.",
      "Heat the ghee, add cumin and sliced onion; cook until light golden, then add the vegetables for 2 minutes.",
      "Add the drained rice, salt and 300 ml water; cover and cook on low heat 15 minutes.",
      "For the raita, mix the curd with grated cucumber and a pinch of salt.",
    ],
  },
  {
    title: "Moong Dal with Jeera Rice",
    description: "Simple yellow moong dal with cumin rice — Jain friendly.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["moong dal", 100, "½ cup"], ["rice", 120, "⅔ cup"], ["tomato", 60, "1 small"], ["ghee", 12, "1 tbsp"],
      ["cumin seeds", 4, "1 tsp"], ["turmeric", 1, "¼ tsp"], ["green chilli", 5, "1"], ["salt", 4, "¾ tsp"],
      ["coriander leaves", 5, "2 tbsp"],
    ],
    steps: [
      "Pressure-cook the moong dal with turmeric, salt, tomato and 400 ml water for 3 whistles.",
      "Temper half the cumin and the green chilli in half the ghee and pour over the dal.",
      "Fry the rest of the cumin in the rest of the ghee, add rice and 2 cups water and cook until tender.",
    ],
  },
  {
    title: "Moong Dal Khichdi",
    description: "Soft one-pot rice and moong dal with ghee — easy on the stomach.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["rice", 100, "½ cup"], ["moong dal", 80, "⅓ cup"], ["green peas", 40, "¼ cup"], ["ghee", 15, "1 tbsp"],
      ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Rinse the rice and dal together.",
      "Heat the ghee in a pressure cooker, add cumin, then rice, dal, peas, turmeric, salt and 900 ml water.",
      "Pressure-cook for 4 whistles; stir well before serving.",
    ],
  },
  {
    title: "Masoor Dal with Rice",
    description: "Quick-cooking red lentil dal with garlic, served with rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["masoor dal", 100, "½ cup"], ["rice", 120, "⅔ cup"], ["onion", 50, "1 small"], ["tomato", 80, "1"], ["garlic", 6, "2 cloves"],
      ["sunflower oil", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Boil the masoor dal with turmeric, salt and 500 ml water for 15 minutes until soft.",
      "Fry cumin, garlic and onion in the oil, then add tomato and chilli powder; cook 4 minutes and stir into the dal.",
      "Serve with rice cooked in 2 cups water.",
    ],
  },
  {
    title: "Sambar Rice",
    description: "Toor dal and vegetable sambar with tamarind, served with rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 35,
    lines: [
      ["toor dal", 80, "⅓ cup"], ["rice", 120, "⅔ cup"], ["brinjal", 80, "1 small"], ["okra", 60, "6 pods"], ["tomato", 80, "1"],
      ["onion", 50, "1 small"], ["tamarind", 15, "small lemon-sized ball"], ["sunflower oil", 10, "2 tsp"],
      ["mustard seeds", 2, "½ tsp"], ["coriander powder", 4, "1½ tsp"], ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Pressure-cook the dal with turmeric and 350 ml water for 4 whistles; mash.",
      "Soak the tamarind in 150 ml warm water and squeeze out the pulp.",
      "Boil the chopped vegetables in the tamarind water with the spices and salt until tender, then add the dal and simmer 5 minutes.",
      "Temper mustard seeds in the oil, pour over and serve with rice.",
    ],
  },
  {
    title: "Tomato Rasam with Rice",
    description: "Thin, peppery tomato-tamarind soup over rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["toor dal", 50, "¼ cup"], ["tomato", 200, "3"], ["tamarind", 10, "small ball"], ["garlic", 6, "2 cloves"],
      ["black pepper", 2, "½ tsp"], ["cumin seeds", 2, "½ tsp"], ["mustard seeds", 2, "½ tsp"], ["sunflower oil", 8, "2 tsp"],
      ["rice", 140, "¾ cup"], ["coriander leaves", 5, "2 tbsp"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Pressure-cook the dal with 250 ml water; mash and thin with 300 ml water.",
      "Crush the pepper, cumin and garlic coarsely.",
      "Simmer chopped tomato with tamarind pulp, the crushed spices and salt for 8 minutes, add the dal water and bring to a froth — don't boil hard.",
      "Temper mustard seeds in the oil, pour over, add coriander and serve with rice.",
    ],
  },
  {
    title: "Vegetable Biryani",
    description: "Layered rice and spiced vegetables with mint, curd and ghee.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 20, cookMinutes: 35,
    lines: [
      ["rice", 150, "¾ cup"], ["carrot", 60, "½"], ["french beans", 60, "½ cup"], ["green peas", 60, "⅓ cup"],
      ["cauliflower", 80, "¾ cup"], ["onion", 100, "1 large"], ["curd", 100, "½ cup"], ["ghee", 20, "4 tsp"],
      ["mint leaves", 10, "½ cup"], ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"], ["red chilli powder", 2, "½ tsp"],
      ["turmeric", 1, "¼ tsp"], ["salt", 5, "1 tsp"],
    ],
    steps: [
      "Soak the rice 20 minutes, then boil in salted water until 70% cooked; drain.",
      "Fry the sliced onion in the ghee until brown; remove half for the top.",
      "Add ginger, garlic, the vegetables, curd, spices and salt; cook 8 minutes.",
      "Layer the rice over the vegetables with mint and fried onion, cover tightly and cook on the lowest heat 15 minutes.",
    ],
  },
  {
    title: "Soya Chunks Curry with Rice",
    description: "High-protein soya chunks in an onion-tomato curry, with rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["soya chunks", 60, "1 cup"], ["onion", 80, "1"], ["tomato", 120, "2 small"], ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"],
      ["sunflower oil", 12, "1 tbsp"], ["coriander powder", 3, "1 tsp"], ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Boil the soya chunks 5 minutes, rinse in cold water and squeeze dry.",
      "Cook onion, ginger and garlic in the oil until golden; add tomato and spices and cook 6 minutes.",
      "Add the chunks, salt and 250 ml water; simmer 10 minutes. Serve with rice.",
    ],
  },
  {
    title: "Tofu Matar with Roti",
    description: "Tofu and green peas in a spiced tomato gravy — a vegan matar paneer.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["tofu", 200, "1 block"], ["green peas", 100, "⅔ cup"], ["onion", 60, "1 small"], ["tomato", 100, "1 large"],
      ["ginger", 6, "1 tsp"], ["sunflower oil", 12, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["coriander powder", 3, "1 tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Press the tofu dry and cut into cubes.",
      "Fry cumin, onion and ginger in the oil, then tomato and coriander powder until thick.",
      "Add peas, salt and 200 ml water; simmer 6 minutes, add the tofu and simmer 3 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Chana Dal Tadka with Roti",
    description: "Nutty split chickpea dal with a ghee and garlic tadka.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 35,
    lines: [
      ["chana dal", 100, "½ cup"], ["onion", 50, "1 small"], ["tomato", 80, "1"], ["garlic", 6, "2 cloves"], ["ghee", 10, "2 tsp"],
      ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"], ["whole wheat flour", 120, "1 cup"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the chana dal 1 hour, then pressure-cook with turmeric, salt and 450 ml water for 5 whistles.",
      "Fry cumin, garlic and onion in the ghee, add tomato and chilli powder, cook 4 minutes and mix into the dal.",
      ROTI_STEP,
    ],
  },
  {
    title: "Kadai Paneer with Roti",
    description: "Paneer and capsicum tossed in a spicy onion-tomato masala.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["paneer", 150, "1 cup cubed"], ["capsicum", 150, "1 large"], ["onion", 80, "1"], ["tomato", 120, "2 small"],
      ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"], ["sunflower oil", 12, "1 tbsp"], ["coriander powder", 4, "1½ tsp"],
      ["red chilli powder", 2, "½ tsp"], ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Fry the capsicum and half the onion (in chunks) in the oil for 3 minutes; set aside.",
      "In the same pan cook the rest of the onion, ginger, garlic, tomato and spices until thick.",
      "Add paneer, the capsicum and onion, salt and a splash of water; toss 3 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Jain Paneer Capsicum Sabzi with Roti",
    description: "Paneer and capsicum in a tomato masala — no onion, garlic or ginger.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["paneer", 150, "1 cup cubed"], ["capsicum", 150, "1 large"], ["tomato", 150, "2"], ["sunflower oil", 12, "1 tbsp"],
      ["cumin seeds", 2, "½ tsp"], ["coriander powder", 4, "1½ tsp"], ["red chilli powder", 2, "½ tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Heat the oil, add cumin and the capsicum; cook 3 minutes.",
      "Add pureed tomato, spices and salt; cook until thick.",
      "Add the paneer and toss 3 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Mushroom Matar with Roti",
    description: "Mushrooms and peas in a light onion-tomato curry.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["mushroom", 200, "2 cups sliced"], ["green peas", 100, "⅔ cup"], ["onion", 60, "1 small"], ["tomato", 100, "1 large"],
      ["garlic", 6, "2 cloves"], ["sunflower oil", 12, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["coriander powder", 3, "1 tsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Fry cumin, onion and garlic in the oil until soft; add tomato and coriander powder and cook 4 minutes.",
      "Add mushrooms, peas and salt; cook 8–10 minutes until the mushrooms are tender.",
      ROTI_STEP,
    ],
  },
  {
    title: "Dal Palak with Rice",
    description: "Toor dal cooked with spinach and garlic, served with rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 30,
    lines: [
      ["toor dal", 100, "½ cup"], ["spinach", 150, "½ bunch"], ["tomato", 60, "1 small"], ["garlic", 6, "2 cloves"],
      ["sunflower oil", 10, "2 tsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"],
      ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Pressure-cook the dal with turmeric, salt and 400 ml water for 4 whistles.",
      "Fry cumin and garlic in the oil, add tomato and chopped spinach and cook 4 minutes.",
      "Stir in the dal and chilli powder and simmer 5 minutes. Serve with rice.",
    ],
  },
  {
    title: "Jain Moong Dal Palak with Rice",
    description: "Moong dal with spinach and tomato — no onion or garlic.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["moong dal", 100, "½ cup"], ["spinach", 150, "½ bunch"], ["tomato", 60, "1 small"], ["ghee", 10, "2 tsp"],
      ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Pressure-cook the moong dal with turmeric, salt and 400 ml water for 3 whistles.",
      "Heat the ghee, add cumin, tomato and chopped spinach; cook 4 minutes, then add the dal and simmer 3 minutes.",
      "Serve with rice.",
    ],
  },
  {
    title: "Chickpea Salad Bowl",
    description: "A filling salad of chickpeas, crunchy vegetables and lemon dressing.",
    cuisine: "indian", mealTypes: ["lunch"], servings: 1, prepMinutes: 15, cookMinutes: 30,
    lines: [
      ["chickpeas", 100, "½ cup (dry)"], ["cucumber", 100, "1 small"], ["tomato", 100, "1 large"], ["onion", 40, "½"],
      ["capsicum", 50, "½"], ["lemon", 30, "½"], ["sunflower oil", 8, "2 tsp"], ["coriander leaves", 10, "¼ cup"],
      ["salt", 2, "a pinch"], ["black pepper", 1, "a pinch"],
    ],
    steps: [
      "Soak the chickpeas overnight and pressure-cook with salt until tender; drain and cool.",
      "Chop the vegetables and toss with the chickpeas.",
      "Whisk the lemon juice, oil, salt and pepper, pour over and mix in the coriander.",
    ],
  },
  {
    title: "Lemon Rice with Peanuts",
    description: "Tangy turmeric rice with crunchy peanuts — no onion or garlic.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 20,
    lines: [
      ["rice", 150, "¾ cup"], ["peanuts", 40, "¼ cup"], ["lemon", 60, "1"], ["sunflower oil", 15, "1 tbsp"],
      ["mustard seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["green chilli", 5, "1"], ["coriander leaves", 5, "2 tbsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Cook the rice so the grains stay separate, and spread it out to cool.",
      "Heat the oil, splutter the mustard seeds, fry the peanuts golden, then add green chilli and turmeric.",
      "Add the rice and salt, toss well, then squeeze over the lemon and add coriander.",
    ],
  },
  {
    title: "Coconut Rice",
    description: "South Indian rice tossed with fresh coconut and cashews.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 20,
    lines: [
      ["rice", 150, "¾ cup"], ["fresh coconut", 80, "⅔ cup grated"], ["cashews", 15, "10"], ["sunflower oil", 10, "2 tsp"],
      ["mustard seeds", 2, "½ tsp"], ["green chilli", 5, "1"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Cook the rice so the grains stay separate and let it cool.",
      "Heat the oil, splutter the mustard seeds, fry the cashews and green chilli, then add the coconut for 2 minutes.",
      "Add the rice and salt and toss gently.",
    ],
  },
  {
    title: "Tomato Rice",
    description: "One-pot rice cooked with tomatoes, onion and peas.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["rice", 150, "¾ cup"], ["tomato", 200, "3"], ["onion", 60, "1 small"], ["green peas", 60, "⅓ cup"],
      ["sunflower oil", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["red chilli powder", 1, "¼ tsp"], ["turmeric", 1, "¼ tsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Heat the oil, add cumin and onion and cook 3 minutes.",
      "Add chopped tomato, spices and salt and cook until soft; add peas.",
      "Add the rinsed rice and 300 ml water, cover and cook on low heat 15 minutes.",
    ],
  },
  {
    title: "Egg Curry with Rice",
    description: "Boiled eggs in a spiced onion-tomato gravy, with rice.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["eggs", 200, "4"], ["onion", 100, "1 large"], ["tomato", 120, "2 small"], ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"],
      ["sunflower oil", 15, "1 tbsp"], ["coriander powder", 3, "1 tsp"], ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Hard-boil the eggs (10 minutes), peel and make a few shallow slits in each.",
      "Fry onion, ginger and garlic in the oil until golden; add tomato and spices and cook until thick.",
      "Add 250 ml water and salt, simmer 5 minutes, add the eggs and simmer 5 minutes more. Serve with rice.",
    ],
  },
  {
    title: "Egg Fried Rice",
    description: "Indo-Chinese fried rice with scrambled egg and crunchy vegetables.",
    cuisine: "indo-chinese", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 15,
    lines: [
      ["rice", 150, "¾ cup"], ["eggs", 150, "3"], ["carrot", 50, "½"], ["french beans", 50, "½ cup"], ["capsicum", 50, "½"],
      ["onion", 50, "1 small"], ["soy sauce", 15, "1 tbsp"], ["sunflower oil", 15, "1 tbsp"], ["black pepper", 1, "¼ tsp"],
      ["salt", 2, "a pinch"],
    ],
    steps: [
      "Cook the rice so the grains stay separate, and cool completely (day-old rice works best).",
      "Scramble the eggs in half the oil and set aside.",
      "Stir-fry the finely chopped vegetables in the rest of the oil on high heat for 3 minutes.",
      "Add the rice, soy sauce, pepper, salt and the egg; toss on high heat for 2 minutes.",
    ],
  },
  {
    title: "Egg Bhurji with Roti",
    description: "Spiced scrambled eggs with onion and tomato, with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 10,
    lines: [
      ["eggs", 200, "4"], ["onion", 60, "1 small"], ["tomato", 80, "1"], ["green chilli", 5, "1"], ["sunflower oil", 10, "2 tsp"],
      ["turmeric", 1, "¼ tsp"], ["red chilli powder", 1, "¼ tsp"], ["coriander leaves", 5, "2 tbsp"],
      ["whole wheat flour", 120, "1 cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Cook onion and green chilli in the oil 2 minutes, then tomato, spices and salt for 3 minutes.",
      "Add the beaten eggs and stir over low heat until just set. Add coriander.",
      ROTI_STEP,
    ],
  },
  {
    title: "Chicken Curry with Rice",
    description: "Home-style chicken curry with onion, tomato and curd.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 35,
    lines: [
      ["chicken breast", 300, "300 g"], ["onion", 100, "1 large"], ["tomato", 120, "2 small"], ["curd", 60, "¼ cup"],
      ["ginger", 8, "2 tsp"], ["garlic", 8, "3 cloves"], ["sunflower oil", 15, "1 tbsp"], ["coriander powder", 4, "1½ tsp"],
      ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"], ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Cut the chicken into pieces and mix with curd, turmeric and salt; rest 20 minutes.",
      "Fry onion, ginger and garlic in the oil until golden brown, then tomato and spices until the oil separates.",
      "Add the chicken and 200 ml water; cover and simmer 20 minutes until cooked through. Serve with rice.",
    ],
  },
  {
    title: "Chicken Biryani",
    description: "Layered basmati rice and marinated chicken with mint and fried onion.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 30, cookMinutes: 40,
    lines: [
      ["rice", 150, "¾ cup"], ["chicken breast", 250, "250 g"], ["onion", 120, "1 large"], ["curd", 100, "½ cup"], ["ghee", 20, "4 tsp"],
      ["mint leaves", 10, "½ cup"], ["ginger", 8, "2 tsp"], ["garlic", 8, "3 cloves"], ["red chilli powder", 2, "½ tsp"],
      ["turmeric", 1, "¼ tsp"], ["salt", 5, "1 tsp"],
    ],
    steps: [
      "Marinate the chicken with curd, ginger, garlic, spices, half the mint and salt for at least 30 minutes.",
      "Soak the rice 20 minutes and boil in salted water until 70% cooked; drain.",
      "Fry the sliced onion in the ghee until brown, add the chicken and cook 10 minutes.",
      "Layer the rice on top with the rest of the mint, cover tightly and cook on the lowest heat for 20 minutes.",
    ],
  },
  {
    title: "Tandoori Chicken with Salad",
    description: "Oven- or pan-grilled spiced chicken with a fresh kachumber salad — low in carbs.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 20, cookMinutes: 25,
    lines: [
      ["chicken breast", 300, "300 g"], ["curd", 80, "⅓ cup"], ["lemon", 30, "½"], ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"],
      ["red chilli powder", 3, "1 tsp"], ["coriander powder", 3, "1 tsp"], ["sunflower oil", 10, "2 tsp"],
      ["cucumber", 150, "1"], ["onion", 60, "1 small"], ["tomato", 100, "1 large"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Marinate the chicken in curd, lemon, ginger, garlic, spices, oil and salt for at least 1 hour.",
      "Grill in a hot oven (220 °C) or a heavy pan for 20–25 minutes, turning once, until cooked through.",
      "Chop cucumber, onion and tomato for the salad and season with salt and lemon.",
    ],
  },
  {
    title: "Chicken Keema Matar with Roti",
    description: "Minced chicken and peas cooked with spices, with rotis.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["chicken breast", 250, "250 g minced"], ["green peas", 100, "⅔ cup"], ["onion", 80, "1"], ["tomato", 100, "1 large"],
      ["ginger", 6, "1 tsp"], ["garlic", 6, "2 cloves"], ["sunflower oil", 12, "1 tbsp"], ["coriander powder", 3, "1 tsp"],
      ["red chilli powder", 2, "½ tsp"], ["whole wheat flour", 120, "1 cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Fry onion, ginger and garlic in the oil until golden.",
      "Add the minced chicken and cook on high heat until it changes colour, breaking up lumps.",
      "Add tomato, spices, peas and salt; cover and cook 12 minutes.",
      ROTI_STEP,
    ],
  },
  {
    title: "Fish Curry with Rice",
    description: "Coastal-style fish curry with coconut and tamarind.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["fish fillet", 300, "300 g"], ["onion", 80, "1"], ["tomato", 100, "1 large"], ["tamarind", 10, "small ball"],
      ["fresh coconut", 40, "⅓ cup grated"], ["sunflower oil", 12, "1 tbsp"], ["turmeric", 1, "¼ tsp"], ["red chilli powder", 2, "½ tsp"],
      ["coriander powder", 3, "1 tsp"], ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Rub the fish with turmeric and salt.",
      "Grind the coconut with the spices and a little water to a paste; soak the tamarind and squeeze out the pulp.",
      "Fry onion in the oil, add tomato and the coconut paste and cook 5 minutes; add tamarind water and 150 ml water and bring to a simmer.",
      "Slide in the fish and simmer gently 8–10 minutes without stirring. Serve with rice.",
    ],
  },
  {
    title: "Masala Fish Fry with Salad",
    description: "Pan-fried spiced fish fillets with a fresh salad.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 20, cookMinutes: 15,
    lines: [
      ["fish fillet", 300, "300 g"], ["besan", 20, "2 tbsp"], ["lemon", 30, "½"], ["turmeric", 1, "¼ tsp"],
      ["red chilli powder", 3, "1 tsp"], ["garlic", 6, "2 cloves"], ["sunflower oil", 15, "1 tbsp"], ["cucumber", 150, "1"],
      ["tomato", 100, "1 large"], ["onion", 50, "1 small"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Coat the fish with crushed garlic, lemon juice, turmeric, chilli powder, salt and the besan; rest 15 minutes.",
      "Shallow-fry in the oil 3–4 minutes per side until cooked through.",
      "Serve with sliced cucumber, tomato and onion.",
    ],
  },
  {
    title: "Prawn Masala with Rice",
    description: "Prawns in a thick spiced onion-tomato masala.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["prawns", 250, "250 g cleaned"], ["onion", 80, "1"], ["tomato", 120, "2 small"], ["ginger", 6, "1 tsp"], ["garlic", 8, "3 cloves"],
      ["sunflower oil", 15, "1 tbsp"], ["coriander powder", 3, "1 tsp"], ["red chilli powder", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["rice", 120, "⅔ cup"], ["salt", 3, "½ tsp"],
    ],
    steps: [
      "Toss the prawns with turmeric and salt.",
      "Fry onion, ginger and garlic in the oil until golden; add tomato and spices and cook until thick.",
      "Add the prawns and cook 4–5 minutes until pink and curled — don't overcook. Serve with rice.",
    ],
  },
  {
    title: "Mutton Curry with Rice",
    description: "Slow-cooked goat curry with onion, tomato and curd.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 20, cookMinutes: 60,
    lines: [
      ["mutton", 300, "300 g"], ["onion", 120, "1 large"], ["tomato", 120, "2 small"], ["curd", 60, "¼ cup"], ["ginger", 8, "2 tsp"],
      ["garlic", 8, "3 cloves"], ["sunflower oil", 15, "1 tbsp"], ["coriander powder", 4, "1½ tsp"], ["red chilli powder", 3, "1 tsp"],
      ["turmeric", 1, "¼ tsp"], ["rice", 120, "⅔ cup"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Marinate the mutton in curd, turmeric and salt for 1 hour.",
      "Brown the onion in the oil, add ginger, garlic, tomato and spices and cook until the oil separates.",
      "Add the mutton, sear 5 minutes, then add 400 ml water and pressure-cook 6–7 whistles until tender. Serve with rice.",
    ],
  },
  {
    title: "Chilli Chicken with Rice",
    description: "Indo-Chinese stir-fried chicken with capsicum, onion and soy sauce.",
    cuisine: "indo-chinese", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 20,
    lines: [
      ["chicken breast", 250, "250 g"], ["capsicum", 100, "1"], ["onion", 80, "1"], ["soy sauce", 20, "1½ tbsp"],
      ["garlic", 8, "3 cloves"], ["green chilli", 6, "2"], ["sunflower oil", 15, "1 tbsp"], ["rice", 120, "⅔ cup"],
      ["salt", 2, "a pinch"],
    ],
    steps: [
      "Cut the chicken into bite-size pieces and sear in half the oil until browned; set aside.",
      "Stir-fry garlic, green chilli, onion and capsicum in the rest of the oil on high heat for 3 minutes.",
      "Add the chicken, soy sauce, salt and a splash of water; toss until glossy. Serve with rice.",
    ],
  },
  {
    title: "Matar Pulao with Raita",
    description: "Green pea pulao with cumin and ghee, served with cucumber raita.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 10, cookMinutes: 25,
    lines: [
      ["rice", 150, "¾ cup"], ["green peas", 100, "⅔ cup"], ["onion", 50, "1 small"], ["ghee", 15, "1 tbsp"], ["cumin seeds", 3, "¾ tsp"],
      ["curd", 150, "⅔ cup"], ["cucumber", 50, "½"], ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Soak the rice 20 minutes.",
      "Fry cumin and sliced onion in the ghee, add the peas, drained rice, salt and 300 ml water.",
      "Cover and cook on low heat 15 minutes. Mix curd with grated cucumber and salt for the raita.",
    ],
  },
  {
    title: "Vegetable Khichdi",
    description: "Rice, moong dal and vegetables cooked soft with ghee — a comforting dinner.",
    cuisine: "indian", mealTypes: BOTH, servings: 2, prepMinutes: 15, cookMinutes: 25,
    lines: [
      ["rice", 100, "½ cup"], ["moong dal", 60, "¼ cup"], ["carrot", 50, "½"], ["green peas", 50, "⅓ cup"], ["potato", 80, "1 small"],
      ["onion", 50, "1 small"], ["tomato", 60, "1 small"], ["ghee", 15, "1 tbsp"], ["cumin seeds", 2, "½ tsp"], ["turmeric", 1, "¼ tsp"],
      ["salt", 4, "¾ tsp"],
    ],
    steps: [
      "Rinse the rice and dal together.",
      "Heat the ghee in a pressure cooker, add cumin and onion, then tomato and the vegetables.",
      "Add rice, dal, turmeric, salt and 900 ml water; pressure-cook 4 whistles.",
    ],
  },
];

// ---------------------------------------------------------------- SQL

// JSON inside a SQL string literal: single quotes doubled.
function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

export function buildStarterSeedSql(): string {
  const ingredients = STARTER_INGREDIENTS.filter((i) => !i.existing).map((i) => ({
    name: i.name,
    aliases: i.aliases,
    fdc_id: i.fdcId,
    kcal: i.per100g.kcal,
    protein: i.per100g.proteinG,
    carbs: i.per100g.carbsG,
    fat: i.per100g.fatG,
    fiber: i.per100g.fiberG,
    allergen_tags: i.allergenTags,
    meat: i.containsMeat,
    fish: i.containsFish,
    egg: i.containsEgg,
    dairy: i.containsDairy,
    honey: i.containsHoney,
    jain: i.jainAvoid,
    aisle: i.aisle,
    unit: i.purchaseUnit,
    pack: i.packSize,
    per_piece: i.gramsPerPiece,
    per_ml: i.gramsPerMl,
    search: i.searchTerm,
  }));
  const recipes = STARTER_RECIPES.map((r) => ({
    title: r.title,
    description: r.description,
    cuisine: r.cuisine,
    meal_types: r.mealTypes,
    servings: r.servings,
    prep: r.prepMinutes,
    cook: r.cookMinutes,
    steps: r.steps,
    lines: r.lines.map(([ingredient, grams, display]) => ({ ingredient, grams, display })),
  }));

  return `-- Starter recipe library: ${ingredients.length} ingredients + ${recipes.length} recipes (CLAUDE.md §15).
-- GENERATED from supabase/seed/starter-library.ts by \`npm run seed:build\` — edit that file, not this one.
--
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again: ingredients and recipes that already exist (same name / title) are skipped.
-- Recipes arrive as DRAFTS. Review them in Admin → Recipes, then use "Publish ready drafts"; publishing
-- recalculates nutrition, allergens and diet types with the app's own engine.

do $seed$
declare
  v_ingredients jsonb := ${sqlJson(ingredients)};
  v_recipes jsonb := ${sqlJson(recipes)};
  v_recipe jsonb;
  v_id bigint;
  v_missing text;
  v_added int := 0;
begin
  insert into public.ingredients (
    name, aliases, fdc_id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
    allergen_tags, contains_meat, contains_fish, contains_egg, contains_dairy, contains_honey, jain_avoid,
    aisle, purchase_unit, pack_size, grams_per_piece, grams_per_ml, search_term
  )
  select
    x->>'name',
    array(select jsonb_array_elements_text(x->'aliases')),
    -- If this USDA food is already linked to another ingredient, keep the numbers but not the link.
    case when exists (select 1 from public.ingredients i where i.fdc_id = (x->>'fdc_id')::integer)
      then null else (x->>'fdc_id')::integer end,
    (x->>'kcal')::numeric, (x->>'protein')::numeric, (x->>'carbs')::numeric, (x->>'fat')::numeric, (x->>'fiber')::numeric,
    array(select jsonb_array_elements_text(x->'allergen_tags')),
    (x->>'meat')::boolean, (x->>'fish')::boolean, (x->>'egg')::boolean, (x->>'dairy')::boolean,
    (x->>'honey')::boolean, (x->>'jain')::boolean,
    x->>'aisle', x->>'unit', (x->>'pack')::numeric, (x->>'per_piece')::numeric, (x->>'per_ml')::numeric, x->>'search'
  from jsonb_array_elements(v_ingredients) as x
  where not exists (select 1 from public.ingredients i where i.name = x->>'name');

  -- Every ingredient a recipe needs must exist now, or nothing is saved.
  select string_agg(distinct l->>'ingredient', ', ') into v_missing
  from jsonb_array_elements(v_recipes) as r, jsonb_array_elements(r->'lines') as l
  where not exists (select 1 from public.ingredients i where i.name = l->>'ingredient');
  if v_missing is not null then
    raise exception 'Missing ingredients: %', v_missing;
  end if;

  for v_recipe in select * from jsonb_array_elements(v_recipes) loop
    continue when exists (select 1 from public.recipes where lower(title) = lower(v_recipe->>'title'));

    insert into public.recipes (title, description, cuisine, meal_types, servings, prep_minutes, cook_minutes, steps, status, source)
    values (
      v_recipe->>'title', v_recipe->>'description', v_recipe->>'cuisine',
      array(select jsonb_array_elements_text(v_recipe->'meal_types')),
      (v_recipe->>'servings')::integer, (v_recipe->>'prep')::integer, (v_recipe->>'cook')::integer,
      array(select jsonb_array_elements_text(v_recipe->'steps')),
      'draft', 'ai'
    )
    returning id into v_id;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, position, grams, display_amount)
    select v_id, i.id, (t.ord - 1)::integer, (t.line->>'grams')::numeric, t.line->>'display'
    from jsonb_array_elements(v_recipe->'lines') with ordinality as t(line, ord)
    join public.ingredients i on i.name = t.line->>'ingredient';

    v_added := v_added + 1;
  end loop;

  raise notice 'Starter library: % new draft recipes added.', v_added;
end
$seed$;
`;
}
