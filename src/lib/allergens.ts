// Allergy options shown in the profile form. See CLAUDE.md §5.3.
// `id` is what we store in the database (named after the original Edamam labels, see CLAUDE.md §5.3).
// `intolerance` / `exclude` are what we send to Spoonacular to filter recipes (layer 1).
// Ingredient keyword lists for the second safety check are added in Step 9.

interface Allergen {
  id: string;
  label: string;
  intolerance?: string;
  exclude?: string[];
}

export const ALLERGENS = [
  { id: "peanut-free", label: "Peanuts", intolerance: "peanut" },
  { id: "tree-nut-free", label: "Tree nuts", intolerance: "tree nut" },
  { id: "dairy-free", label: "Dairy / milk", intolerance: "dairy" },
  { id: "egg-free", label: "Eggs", intolerance: "egg" },
  { id: "soy-free", label: "Soy", intolerance: "soy" },
  { id: "wheat-free", label: "Wheat", intolerance: "wheat" },
  { id: "gluten-free", label: "Gluten", intolerance: "gluten" },
  { id: "fish-free", label: "Fish", intolerance: "seafood" },
  { id: "shellfish-free", label: "Shellfish", intolerance: "shellfish" },
  { id: "crustacean-free", label: "Crustaceans", intolerance: "shellfish" },
  { id: "mollusk-free", label: "Molluscs", intolerance: "shellfish" },
  { id: "sesame-free", label: "Sesame", intolerance: "sesame" },
  { id: "mustard-free", label: "Mustard", exclude: ["mustard"] },
  { id: "celery-free", label: "Celery", exclude: ["celery", "celeriac"] },
  { id: "lupine-free", label: "Lupin", exclude: ["lupin", "lupine"] },
  { id: "sulfite-free", label: "Sulphites", intolerance: "sulfite" },
] as const satisfies readonly Allergen[];

export type AllergenId = (typeof ALLERGENS)[number]["id"];

export const ALLERGEN_IDS = ALLERGENS.map((a) => a.id) as [AllergenId, ...AllergenId[]];

function findAllergen(id: AllergenId): Allergen | undefined {
  return ALLERGENS.find((a) => a.id === id);
}

export function allergenLabel(id: AllergenId): string {
  return findAllergen(id)?.label ?? id;
}

// Turns "Kiwi, strawberry ,, " into ["kiwi", "strawberry"].
export function parseOtherAllergies(text: string): string[] {
  const words = text
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return [...new Set(words)];
}

// Spoonacular `intolerances` values for the selected allergies (deduplicated, sorted for stable caching).
export function spoonacularIntolerances(ids: readonly AllergenId[]): string[] {
  const values = ids.map((id) => findAllergen(id)?.intolerance).filter((v): v is string => !!v);
  return [...new Set(values)].sort();
}

// Spoonacular `excludeIngredients` values: mapped allergies plus the user's free-text ones.
export function spoonacularExcludes(ids: readonly AllergenId[], other: readonly string[]): string[] {
  const values = [...ids.flatMap((id) => findAllergen(id)?.exclude ?? []), ...other];
  return [...new Set(values)].sort();
}
