"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import {
  type DraftResult,
  draftRecipeAction,
  rematchDraftAction,
  saveDraftAction,
} from "@/app/admin/recipes/draft/actions";
import { DIET_TYPES, type DietType } from "@/lib/diet";
import type { MealType } from "@/lib/nutrition";

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base " +
  "focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 dark:border-zinc-700";
const primaryButton =
  "rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
const secondaryButton =
  "rounded-xl border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];

export default function RecipeDrafter() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [mealTypes, setMealTypes] = useState<MealType[]>(["lunch", "dinner"]);
  const [servings, setServings] = useState("2");
  const [diet, setDiet] = useState<DietType | "">("");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingLabel, setPendingLabel] = useState("");

  function run(label: string, task: () => Promise<void>) {
    setError("");
    setPendingLabel(label);
    startTransition(task);
  }

  function draft(event: FormEvent) {
    event.preventDefault();
    run("Asking Gemini… (free tier: can take up to a minute)", async () => {
      const r = await draftRecipeAction({ description, mealTypes, servings: Number(servings), diet: diet || null });
      if (!r.ok) setError(r.error);
      else setResult(r);
    });
  }

  function recheck() {
    if (!result) return;
    run("Checking your library…", async () => {
      const r = await rematchDraftAction(result.draft);
      if (!r.ok) setError(r.error);
      else setResult(r);
    });
  }

  function save(dropUnmatched: boolean) {
    if (!result) return;
    run("Saving…", async () => {
      const r = await saveDraftAction(result.draft, mealTypes, dropUnmatched);
      if (!r.ok) setError(r.error);
      else router.push(`/admin/recipes/${r.id}?created=1`);
    });
  }

  const unmatched = result?.lines.filter((l) => l.ingredientId === null) ?? [];

  return (
    <div className="space-y-8">
      <form onSubmit={draft} className="space-y-5 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block text-sm font-medium">
          Describe the dish
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={300}
            required
            placeholder="e.g. High-protein moong dal chilla with paneer stuffing"
            className={inputClass}
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium">For</legend>
          <div className="mt-1 flex flex-wrap gap-2">
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

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Servings
            <input type="number" min={1} max={20} value={servings} onChange={(e) => setServings(e.target.value)} className={inputClass} required />
          </label>
          <label className="block text-sm font-medium">
            Diet
            <select value={diet} onChange={(e) => setDiet(e.target.value as DietType | "")} className={inputClass}>
              <option value="">Any</option>
              {DIET_TYPES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="submit" disabled={pending || description.trim().length < 3 || mealTypes.length === 0} className={primaryButton}>
          Draft recipe with AI
        </button>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Only the dish description and your ingredient names are sent to Google Gemini (free tier). No user data.
        </p>
      </form>

      {pending && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          {pendingLabel}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <section aria-labelledby="draft-title" className="space-y-4">
          <div>
            <h2 id="draft-title" className="text-2xl font-bold">
              {result.draft.title}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {result.draft.description} · {result.draft.servings} servings · {result.draft.prepMinutes + result.draft.cookMinutes} min
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Ingredients (whole recipe)</h3>
            <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {result.lines.map((l, i) => (
                <li key={`${l.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <span aria-hidden className={l.ingredientId ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                      {l.ingredientId ? "✓ " : "! "}
                    </span>
                    <strong>{l.name}</strong> — {l.grams} g{l.displayAmount && ` (${l.displayAmount})`}
                    <span className="sr-only">{l.ingredientId ? ", in your library" : ", not in your library yet"}</span>
                  </span>
                  {!l.ingredientId && (
                    <a
                      href={`/admin/ingredients?q=${encodeURIComponent(l.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      Add to library<span className="sr-only"> (opens in a new tab)</span> →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Steps</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {result.draft.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          {result.summary ? (
            <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <p className="text-base">
                <strong>{result.summary.kcal} kcal</strong> per serving · P {result.summary.proteinG} g · C {result.summary.carbsG} g · F{" "}
                {result.summary.fatG} g
              </p>
              <p className="mt-1">
                <span className="font-semibold">Contains:</span> {result.summary.allergens.join(", ") || "none of the 16 allergens"}
              </p>
              <p>
                <span className="font-semibold">Suits:</span> {result.summary.diets.join(", ")}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Calculated by our engine from your library — not by the AI.</p>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {unmatched.length} ingredient{unmatched.length === 1 ? " isn't" : "s aren't"} in your library yet. Add{" "}
              {unmatched.length === 1 ? "it" : "them"} (links open in a new tab), then press <strong>Check again</strong>.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => save(false)} disabled={pending || unmatched.length > 0} className={primaryButton}>
              Save as draft recipe
            </button>
            {unmatched.length > 0 && (
              <>
                <button type="button" onClick={recheck} disabled={pending} className={secondaryButton}>
                  Check again
                </button>
                <button type="button" onClick={() => save(true)} disabled={pending} className={secondaryButton}>
                  Save without missing ones
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
