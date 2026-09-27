"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState, useTransition } from "react";
import { deleteRecipeAction, saveRecipeAction, setRecipeStatusAction } from "@/app/admin/recipes/actions";
import { allergenLabel } from "@/lib/allergens";
import { dietLabel } from "@/lib/diet";
import type { Ingredient, RecipeStatus } from "@/lib/library";
import type { MealType } from "@/lib/nutrition";
import { type RecipeLine, analyzeRecipe } from "@/lib/recipe-analysis";
import { type RecipeInput, publishProblems } from "@/lib/recipe-input";

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base " +
  "focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 dark:border-zinc-700";
const primaryButton =
  "btn btn-primary";
const secondaryButton =
  "btn btn-secondary";

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];

interface LineDraft {
  key: number;
  ingredientId: number;
  grams: string;
  displayAmount: string;
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

interface RecipeEditorProps {
  ingredients: Ingredient[];
  initial?: RecipeInput;
  status?: RecipeStatus;
}

export default function RecipeEditor({ ingredients, initial, status }: RecipeEditorProps) {
  const router = useRouter();
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? "indian");
  const [mealTypes, setMealTypes] = useState<MealType[]>(initial?.mealTypes ?? []);
  const [servings, setServings] = useState(String(initial?.servings ?? 2));
  const [prepMinutes, setPrepMinutes] = useState(String(initial?.prepMinutes ?? 10));
  const [cookMinutes, setCookMinutes] = useState(String(initial?.cookMinutes ?? 20));
  const [steps, setSteps] = useState((initial?.steps ?? []).join("\n"));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    (initial?.lines ?? []).map((l, i) => ({
      key: i,
      ingredientId: l.ingredientId,
      grams: String(l.grams),
      displayAmount: l.displayAmount,
    })),
  );
  const [nextKey, setNextKey] = useState(lines.length);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; warnings?: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const stepList = steps
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Live preview: the same calculation the server repeats on save.
  const recipeLines: RecipeLine[] = lines.flatMap((l) => {
    const ingredient = byId.get(l.ingredientId);
    const grams = num(l.grams);
    return ingredient && grams > 0 ? [{ grams, ingredient }] : [];
  });
  const servingsNum = Math.max(1, Math.round(num(servings)) || 1);
  const analysis = analyzeRecipe(title, servingsNum, recipeLines);
  const problems = publishProblems({ steps: stepList, lines: recipeLines }, analysis);
  const n = analysis.nutrition.perServing;

  const q = search.trim().toLowerCase();
  const matches =
    q.length === 0
      ? []
      : ingredients.filter((i) => i.name.includes(q) || i.aliases.some((a) => a.includes(q))).slice(0, 8);

  function addIngredient(id: number) {
    setLines((current) => [...current, { key: nextKey, ingredientId: id, grams: "", displayAmount: "" }]);
    setNextKey((k) => k + 1);
    setSearch("");
  }

  const updateLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function toInput(): RecipeInput {
    return {
      id: initial?.id ?? null,
      title,
      description,
      cuisine,
      mealTypes,
      servings: num(servings),
      prepMinutes: num(prepMinutes) || 0,
      cookMinutes: num(cookMinutes) || 0,
      steps: stepList,
      imageUrl,
      lines: lines.map((l) => ({ ingredientId: l.ingredientId, grams: num(l.grams), displayAmount: l.displayAmount.trim(), note: "" })),
    };
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveRecipeAction(toInput());
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "ok", text: "Saved.", warnings: result.warnings });
      if (!initial?.id) router.replace(`/admin/recipes/${result.id}?created=1`);
      else router.refresh();
    });
  }

  function changeStatus(publish: boolean) {
    if (!initial?.id) return;
    setMessage(null);
    startTransition(async () => {
      const result = await setRecipeStatusAction(initial.id!, publish);
      if (!result.ok) setMessage({ tone: "error", text: result.error });
      else {
        setMessage({ tone: "ok", text: publish ? "Published — users can now get this recipe." : "Moved back to draft." });
        router.refresh();
      }
    });
  }

  function remove() {
    if (!initial?.id || !window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteRecipeAction(initial.id!);
      if (!result.ok) setMessage({ tone: "error", text: result.error });
      else router.push("/admin/recipes");
    });
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required maxLength={120} />
        </Field>
        <Field label="Cuisine">
          <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={inputClass} required maxLength={40} />
        </Field>
      </div>

      <Field label="Short description (optional)">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={600} className={inputClass} />
      </Field>

      <fieldset>
        <legend className="font-semibold">Suitable for</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50 dark:border-zinc-800 dark:has-[:checked]:bg-emerald-950"
            >
              <input
                type="checkbox"
                checked={mealTypes.includes(m.id)}
                onChange={(e) => setMealTypes((c) => (e.target.checked ? [...c, m.id] : c.filter((x) => x !== m.id)))}
                className="h-4 w-4 accent-emerald-700"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Servings">
          <input type="number" min={1} max={20} value={servings} onChange={(e) => setServings(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Prep (min)">
          <input type="number" min={0} value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Cook (min)">
          <input type="number" min={0} value={cookMinutes} onChange={(e) => setCookMinutes(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Ingredients (whole recipe, raw weight)</legend>
        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((l) => {
              const ingredient = byId.get(l.ingredientId);
              return (
                <li key={l.key} className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
                  <span className="pb-2 font-medium">
                    {ingredient?.name ?? "(deleted ingredient)"}
                    {ingredient && !ingredient.per100g && (
                      <span className="block text-xs text-amber-700 dark:text-amber-400">no nutrition yet</span>
                    )}
                  </span>
                  <Field label="Grams">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={l.grams}
                      onChange={(e) => updateLine(l.key, { grams: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </Field>
                  <Field label="Shown as" className="hidden sm:block">
                    <input
                      value={l.displayAmount}
                      onChange={(e) => updateLine(l.key, { displayAmount: e.target.value })}
                      placeholder="1 cup"
                      maxLength={40}
                      className={inputClass}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setLines((c) => c.filter((x) => x.key !== l.key))}
                    className="mb-1 rounded-lg px-2 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    aria-label={`Remove ${ingredient?.name ?? "ingredient"}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div>
          <label htmlFor="ingredient-search" className="block text-sm font-medium">
            Add an ingredient from your library
          </label>
          <input
            id="ingredient-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search, e.g. ghee"
            className={inputClass}
            autoComplete="off"
          />
          {q.length > 0 && (
            <ul className="mt-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {matches.length === 0 ? (
                <li className="p-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Not in your library yet — add it on the Ingredients page first.
                </li>
              ) : (
                matches.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => addIngredient(i.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {i.name}
                      {i.aliases.length > 0 && <span className="text-zinc-600 dark:text-zinc-400"> ({i.aliases.join(", ")})</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </fieldset>

      <Field label="Steps (one per line)">
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} className={inputClass} />
      </Field>

      <Field label="Photo link (optional, https://…)">
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} inputMode="url" />
      </Field>

      <section aria-labelledby="preview-heading" className="space-y-3 card">
        <h2 id="preview-heading" className="font-semibold">
          Live check (per serving)
        </h2>
        {n ? (
          <p className="text-lg">
            <strong>{n.kcal} kcal</strong> · Protein {n.proteinG} g · Carbs {n.carbsG} g · Fat {n.fatG} g · Fibre {n.fiberG} g
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {analysis.nutrition.missing.length > 0
              ? `Missing nutrition for: ${analysis.nutrition.missing.join(", ")}`
              : "Add ingredients with grams to see nutrition."}
          </p>
        )}
        <p className="text-sm">
          <span className="font-semibold">Contains:</span>{" "}
          {analysis.allergens.tags.length > 0 ? analysis.allergens.tags.map(allergenLabel).join(", ") : "none of the 16 allergens"}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Suits:</span>{" "}
          {analysis.diets.dietTypes.map(dietLabel).join(", ")}
        </p>
        {[...analysis.allergens.warnings, ...analysis.diets.warnings].length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
            {[...analysis.allergens.warnings, ...analysis.diets.warnings].map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {problems.length > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold">Before publishing:</span> {problems.join(" ")}
          </p>
        )}
      </section>

      {message && (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-lg p-3 text-sm ${
            message.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {message.text}
          {message.warnings && message.warnings.length > 0 && " Please review the warnings above."}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Working…" : initial?.id ? "Save changes" : "Save as draft"}
        </button>
        {initial?.id && status === "draft" && (
          <button type="button" onClick={() => changeStatus(true)} disabled={pending || problems.length > 0} className={secondaryButton}>
            Publish
          </button>
        )}
        {initial?.id && status === "published" && (
          <button type="button" onClick={() => changeStatus(false)} disabled={pending} className={secondaryButton}>
            Unpublish
          </button>
        )}
        {initial?.id && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-xl px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        )}
      </div>
      {initial?.id && status === "draft" && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Save your changes before publishing.</p>
      )}
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}
      {children}
    </label>
  );
}
