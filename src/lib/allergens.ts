// Allergy options shown in the profile form. See CLAUDE.md §5.3.
// `id` is the Edamam `health` label we send to the recipe API and store in the database.
// Ingredient keyword lists for the second safety check are added in Step 9.

export const ALLERGENS = [
  { id: "peanut-free", label: "Peanuts" },
  { id: "tree-nut-free", label: "Tree nuts" },
  { id: "dairy-free", label: "Dairy / milk" },
  { id: "egg-free", label: "Eggs" },
  { id: "soy-free", label: "Soy" },
  { id: "wheat-free", label: "Wheat" },
  { id: "gluten-free", label: "Gluten" },
  { id: "fish-free", label: "Fish" },
  { id: "shellfish-free", label: "Shellfish" },
  { id: "crustacean-free", label: "Crustaceans" },
  { id: "mollusk-free", label: "Molluscs" },
  { id: "sesame-free", label: "Sesame" },
  { id: "mustard-free", label: "Mustard" },
  { id: "celery-free", label: "Celery" },
  { id: "lupine-free", label: "Lupin" },
  { id: "sulfite-free", label: "Sulphites" },
] as const;

export type AllergenId = (typeof ALLERGENS)[number]["id"];

export const ALLERGEN_IDS = ALLERGENS.map((a) => a.id) as [AllergenId, ...AllergenId[]];

export function allergenLabel(id: AllergenId): string {
  return ALLERGENS.find((a) => a.id === id)?.label ?? id;
}

// Turns "Kiwi, strawberry ,, " into ["kiwi", "strawberry"].
export function parseOtherAllergies(text: string): string[] {
  const words = text
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return [...new Set(words)];
}
