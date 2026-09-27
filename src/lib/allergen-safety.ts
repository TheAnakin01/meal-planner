// Layer 2 allergen check (CLAUDE.md §5.3). Runs on the server after Spoonacular returns results,
// because Spoonacular's own filter is not reliable enough on its own (see CLAUDE.md §5.3).
//
// Principle: when in doubt, throw the recipe out. A missing recipe is an inconvenience;
// a wrong recipe could hurt someone.

import type { AllergenId } from "@/lib/allergens";
import type { Recipe } from "@/lib/spoonacular";

interface AllergenRule {
  // Words that mean the allergen is (or may be) present. Plurals are matched automatically.
  keywords: string[];
  // Phrases that contain a keyword but are safe for this allergy (removed before checking).
  safePhrases?: string[];
  // Labels that make the NEXT word safe, e.g. "dairy-free chocolate", "vegan butter".
  safePrefixes?: string[];
}

const CRUSTACEANS = ["shrimp", "prawn", "crab", "lobster", "crayfish", "crawfish", "langoustine", "scampi", "krill"];
const MOLLUSCS = [
  "clam", "mussel", "oyster", "scallop", "squid", "calamari", "octopus", "snail", "escargot",
  "abalone", "cockle", "whelk", "cuttlefish",
];
const SEAFOOD_GENERIC = ["shellfish", "seafood"];

const WHEAT = [
  "wheat", "flour", "bread", "breadcrumb", "panko", "crouton", "pasta", "spaghetti", "macaroni", "penne",
  "fusilli", "linguine", "fettuccine", "lasagna", "lasagne", "ravioli", "tortellini", "orzo", "gnocchi",
  "noodle", "udon", "ramen", "couscous", "semolina", "bulgur", "bulgar", "farro", "spelt", "durum", "seitan",
  "tortilla", "pita", "naan", "bagel", "croissant", "bun", "roll", "wrap", "cracker", "biscuit", "cookie",
  "cake", "muffin", "pastry", "pie crust", "pizza dough", "dumpling", "wonton", "graham", "bisquick",
  "pancake mix", "doughnut", "donut", "breaded", "soy sauce", "teriyaki", "hoisin",
];
const WHEAT_SAFE = [
  "almond flour", "coconut flour", "rice flour", "chickpea flour", "gram flour", "tapioca flour",
  "potato flour", "cassava flour", "corn flour", "buckwheat flour", "oat flour", "gluten-free flour",
  "gluten free flour", "rice noodle", "glass noodle", "corn tortilla", "rice cake", "rice paper wrap",
  "lettuce wrap",
];
const WHEAT_SAFE_PREFIXES = ["gluten-free", "gluten free", "wheat-free", "wheat free"];

const RULES: Record<AllergenId, AllergenRule> = {
  "peanut-free": {
    keywords: ["peanut", "groundnut", "arachis", "monkey nut", "satay"],
  },
  "tree-nut-free": {
    keywords: [
      "almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut", "filbert", "macadamia", "brazil nut",
      "pine nut", "pignoli", "chestnut", "praline", "marzipan", "frangipane", "nougat", "nutella",
      "gianduja", "nut", "mixed nuts", "nut butter", "nut milk", "nutty",
    ],
  },
  "dairy-free": {
    keywords: [
      "milk", "buttermilk", "butter", "butterscotch", "ghee", "cheese", "cheesecake", "cream", "creamer",
      "creme", "yogurt", "yoghurt", "kefir", "whey", "casein", "caseinate", "lactose", "curd", "custard",
      "ricotta", "mozzarella", "parmesan", "parmigiano", "pecorino", "cheddar", "feta", "mascarpone",
      "paneer", "brie", "camembert", "gouda", "gruyere", "halloumi", "quark", "burrata", "half and half",
      "half-and-half", "margarine", "chocolate", "milkshake", "gelato", "ice cream", "dulce de leche",
      // Describing words used in titles ("Cheesy Broccoli Bake").
      "cheesy", "creamy", "buttery", "buttered", "milky",
    ],
    safePhrases: [
      "coconut milk", "coconut cream", "cream of coconut", "almond milk", "oat milk", "soy milk", "soya milk",
      "rice milk", "cashew milk", "hemp milk", "nut milk", "peanut butter", "almond butter", "cashew butter",
      "nut butter", "sunflower seed butter", "seed butter", "apple butter", "cocoa butter", "cream of tartar",
    ],
    safePrefixes: ["dairy-free", "dairy free", "non-dairy", "non dairy", "nondairy", "vegan"],
  },
  "egg-free": {
    keywords: [
      "egg", "egg white", "egg yolk", "yolk", "albumen", "mayonnaise", "mayo", "aioli", "meringue",
      "eggnog", "hollandaise", "bearnaise", "eggy",
    ],
    safePrefixes: ["egg-free", "egg free", "vegan"],
  },
  "soy-free": {
    keywords: [
      "soy", "soya", "soybean", "tofu", "tempeh", "edamame", "miso", "tamari", "shoyu", "natto",
      "teriyaki", "hoisin", "textured vegetable protein", "tvp", "lecithin",
    ],
    safePrefixes: ["soy-free", "soy free"],
  },
  "wheat-free": { keywords: WHEAT, safePhrases: WHEAT_SAFE, safePrefixes: WHEAT_SAFE_PREFIXES },
  "gluten-free": {
    keywords: [...WHEAT, "barley", "rye", "malt", "beer", "ale", "lager", "brewer's yeast", "oat", "oatmeal"],
    safePhrases: WHEAT_SAFE,
    safePrefixes: ["gluten-free", "gluten free"],
  },
  "fish-free": {
    keywords: [
      "fish", "salmon", "tuna", "cod", "haddock", "halibut", "anchovy", "anchovies", "sardine", "mackerel",
      "trout", "tilapia", "bass", "snapper", "swordfish", "herring", "pollock", "catfish", "mahi mahi",
      "sole", "flounder", "perch", "carp", "eel", "branzino", "monkfish", "grouper", "sea bream",
      "barramundi", "kipper", "bonito", "dashi", "surimi", "caviar", "roe", "worcestershire", "caesar",
      "fish sauce", ...SEAFOOD_GENERIC,
    ],
  },
  "shellfish-free": { keywords: [...CRUSTACEANS, ...MOLLUSCS, ...SEAFOOD_GENERIC, "oyster sauce"] },
  "crustacean-free": { keywords: [...CRUSTACEANS, ...SEAFOOD_GENERIC] },
  "mollusk-free": { keywords: [...MOLLUSCS, ...SEAFOOD_GENERIC, "oyster sauce"] },
  "sesame-free": {
    keywords: ["sesame", "tahini", "benne", "gomasio", "halva", "halvah", "hummus", "houmous", "za'atar", "zaatar", "furikake"],
  },
  "mustard-free": {
    keywords: ["mustard", "dijon", "mayonnaise", "mayo", "curry powder"],
  },
  "celery-free": {
    // Stock, broth and bouillon usually contain celery.
    keywords: ["celery", "celeriac", "celery salt", "celery seed", "mirepoix", "stock", "broth", "bouillon"],
  },
  "lupine-free": { keywords: ["lupin", "lupine", "lupini"] },
  "sulfite-free": {
    keywords: [
      "sulfite", "sulphite", "sulfur dioxide", "wine", "sherry", "vermouth", "port", "beer", "cider",
      "vinegar", "raisin", "sultana", "prune", "dried apricot", "dried fruit", "dried cranberry",
      "molasses", "maraschino", "pickle",
    ],
  },
};

// Lowercase, strip accents (crème → creme), turn punctuation into spaces.
function normalize(text: string): string {
  return ` ${text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9'\- ]+/g, " ")
    .replace(/\s+/g, " ")} `;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches the word or phrase as whole words, with common plural/singular forms:
// berry ↔ berries, peach ↔ peaches, nut ↔ nuts.
function wordPattern(keyword: string): RegExp {
  const k = normalize(keyword).trim();
  const forms = new Set([k]);
  if (k.endsWith("ies")) forms.add(`${k.slice(0, -3)}y`);
  else if (k.endsWith("es")) forms.add(k.slice(0, -2));
  else if (k.endsWith("s")) forms.add(k.slice(0, -1));
  const alternatives = [...forms].map((f) => {
    const base = escapeRegex(f);
    return f.endsWith("y") ? `${base}|${escapeRegex(f.slice(0, -1))}ies` : `${base}(?:e?s)?`;
  });
  return new RegExp(`(?<![a-z0-9])(?:${alternatives.join("|")})(?![a-z0-9])`);
}

function removePhrases(text: string, phrases: readonly string[]): string {
  return phrases.reduce((t, p) => t.replace(new RegExp(wordPattern(p).source, "g"), " "), text);
}

function removePrefixedWords(text: string, prefixes: readonly string[]): string {
  return prefixes.reduce(
    (t, p) => t.replace(new RegExp(`(?<![a-z0-9])${escapeRegex(p)} [a-z0-9'-]+`, "g"), " "),
    text,
  );
}

function findKeyword(text: string, keywords: readonly string[]): string | null {
  return keywords.find((k) => wordPattern(k).test(text)) ?? null;
}

export interface SafetyResult {
  safe: boolean;
  reasons: string[];
}

export function checkRecipeSafety(
  recipe: Pick<Recipe, "title" | "ingredients" | "dairyFree" | "glutenFree">,
  allergies: readonly AllergenId[],
  otherAllergies: readonly string[],
): SafetyResult {
  const reasons: string[] = [];
  const text = normalize([recipe.title, ...recipe.ingredients].join(" | "));

  for (const id of allergies) {
    // Spoonacular's own labels: if it says the recipe isn't free of the allergen, believe it.
    if (id === "dairy-free" && recipe.dairyFree === false) reasons.push("dairy-free: flagged by Spoonacular");
    if ((id === "gluten-free" || id === "wheat-free") && recipe.glutenFree === false) {
      reasons.push(`${id}: flagged by Spoonacular`);
    }

    const rule = RULES[id];
    const cleaned = removePhrases(removePrefixedWords(text, rule.safePrefixes ?? []), rule.safePhrases ?? []);
    const hit = findKeyword(cleaned, rule.keywords);
    if (hit) reasons.push(`${id}: "${hit}"`);
  }

  const otherHit = findKeyword(text, otherAllergies);
  if (otherHit) reasons.push(`other: "${otherHit}"`);

  return { safe: reasons.length === 0, reasons };
}

export function filterSafeRecipes(
  recipes: readonly Recipe[],
  allergies: readonly AllergenId[],
  otherAllergies: readonly string[],
): Recipe[] {
  return recipes.filter((r) => checkRecipeSafety(r, allergies, otherAllergies).safe);
}
