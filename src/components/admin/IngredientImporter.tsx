"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { createIngredientAction, searchUsdaAction } from "@/app/admin/ingredients/actions";
import { ALLERGENS, type AllergenId } from "@/lib/allergens";
import type { IngredientInput } from "@/lib/ingredient-input";
import { AISLES, type AisleId, type PurchaseUnit } from "@/lib/library";
import { suggestIngredientTags } from "@/lib/recipe-analysis";
import type { UsdaFood } from "@/lib/usda";

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base " +
  "focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 dark:border-zinc-700";
const buttonClass =
  "rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";

const FLAGS = [
  { key: "containsMeat", label: "Meat" },
  { key: "containsFish", label: "Fish / seafood" },
  { key: "containsEgg", label: "Egg" },
  { key: "containsDairy", label: "Dairy" },
  { key: "containsHoney", label: "Honey" },
  { key: "jainAvoid", label: "Not Jain (onion, garlic, root veg, mushroom)" },
] as const;
type FlagKey = (typeof FLAGS)[number]["key"];

interface Draft {
  name: string;
  aliases: string;
  fdcId: number | null;
  usdaDescription: string | null;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  allergenTags: AllergenId[];
  flags: Record<FlagKey, boolean>;
  aisle: AisleId;
  purchaseUnit: PurchaseUnit;
  packSize: string;
  gramsPerPiece: string;
  gramsPerMl: string;
  searchTerm: string;
}

const splitNames = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

function withSuggestedTags(draft: Draft): Draft {
  const s = suggestIngredientTags(draft.name, splitNames(draft.aliases));
  const { allergenTags, ...flags } = s;
  return { ...draft, allergenTags, flags };
}

function newDraft(name: string, food: UsdaFood | null): Draft {
  const n = food?.per100g;
  return withSuggestedTags({
    name: name.trim().toLowerCase(),
    aliases: "",
    fdcId: food?.fdcId ?? null,
    usdaDescription: food?.description ?? null,
    kcal: n ? String(n.kcal) : "",
    protein: n ? String(n.proteinG) : "",
    carbs: n ? String(n.carbsG) : "",
    fat: n ? String(n.fatG) : "",
    fiber: n ? String(n.fiberG) : "0",
    allergenTags: [],
    flags: { containsMeat: false, containsFish: false, containsEgg: false, containsDairy: false, containsHoney: false, jainAvoid: false },
    aisle: "other",
    purchaseUnit: "g",
    packSize: "500",
    gramsPerPiece: "",
    gramsPerMl: "1",
    searchTerm: name.trim().toLowerCase(),
  });
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export default function IngredientImporter() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UsdaFood[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function search(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await searchUsdaAction(query);
      if ("error" in result) {
        setResults(null);
        setMessage({ tone: "error", text: result.error });
      } else {
        setResults(result.foods);
      }
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const input: IngredientInput = {
      name: draft.name,
      aliases: splitNames(draft.aliases),
      fdcId: draft.fdcId,
      per100g: {
        kcal: num(draft.kcal),
        proteinG: num(draft.protein),
        carbsG: num(draft.carbs),
        fatG: num(draft.fat),
        fiberG: num(draft.fiber),
      },
      allergenTags: draft.allergenTags,
      ...draft.flags,
      aisle: draft.aisle,
      purchaseUnit: draft.purchaseUnit,
      packSize: num(draft.packSize),
      gramsPerPiece: draft.purchaseUnit === "piece" ? num(draft.gramsPerPiece) : null,
      gramsPerMl: num(draft.gramsPerMl),
      searchTerm: draft.searchTerm,
    };
    setMessage(null);
    startTransition(async () => {
      const result = await createIngredientAction(input);
      if ("error" in result) {
        setMessage({ tone: "error", text: result.error });
      } else {
        setMessage({ tone: "ok", text: `Saved "${draft.name}".` });
        setDraft(null);
        setResults(null);
        setQuery("");
      }
    });
  }

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <section aria-labelledby="add-ingredient" className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 id="add-ingredient" className="text-xl font-bold">
        Add an ingredient
      </h2>

      <form onSubmit={search} className="flex gap-2">
        <label htmlFor="usda-query" className="sr-only">
          Search USDA
        </label>
        <input
          id="usda-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. paneer, moong dal, ghee"
          className={`${inputClass} mt-0`}
        />
        <button type="submit" disabled={pending || query.trim().length < 2} className={buttonClass}>
          Search
        </button>
      </form>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-lg p-3 text-sm ${
            message.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {message.text}
        </p>
      )}

      {results && !draft && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {results.length === 0 ? "No USDA matches." : "Pick the closest match (values per 100 g):"}
          </p>
          <ul className="space-y-2">
            {results.map((food) => (
              <li key={food.fdcId}>
                <button
                  type="button"
                  onClick={() => setDraft(newDraft(query, food))}
                  className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <span className="block font-medium">{food.description}</span>
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    {food.dataType} · {food.per100g.kcal} kcal · P {food.per100g.proteinG} g · C {food.per100g.carbsG} g · F{" "}
                    {food.per100g.fatG} g
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setDraft(newDraft(query, null))} className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            None fit — enter nutrition myself
          </button>
        </div>
      )}

      {draft && (
        <form onSubmit={save} className="space-y-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {draft.usdaDescription ? (
              <>
                From USDA: <strong>{draft.usdaDescription}</strong>. Check the numbers — USDA values for Indian foods
                aren&apos;t always right.
              </>
            ) : (
              "Entering nutrition manually (e.g. from the pack label)."
            )}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (lowercase, as used in recipes)">
              <input value={draft.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} required />
            </Field>
            <Field label="Other names (comma-separated)">
              <input value={draft.aliases} onChange={(e) => update({ aliases: e.target.value })} placeholder="e.g. cottage cheese" className={inputClass} />
            </Field>
          </div>

          <fieldset>
            <legend className="font-semibold">Nutrition per 100 g</legend>
            <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ["kcal", "kcal"],
                  ["protein", "Protein g"],
                  ["carbs", "Carbs g"],
                  ["fat", "Fat g"],
                  ["fiber", "Fibre g"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input type="number" step="0.01" min="0" inputMode="decimal" value={draft[key]} onChange={(e) => update({ [key]: e.target.value })} className={inputClass} required />
                </Field>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">Contains allergens</legend>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Suggested from the name — please check.</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ALLERGENS.map((a) => (
                <Check
                  key={a.id}
                  label={a.label}
                  checked={draft.allergenTags.includes(a.id)}
                  onChange={(on) => update({ allergenTags: on ? [...draft.allergenTags, a.id] : draft.allergenTags.filter((t) => t !== a.id) })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">Diet flags</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FLAGS.map((f) => (
                <Check key={f.key} label={f.label} checked={draft.flags[f.key]} onChange={(on) => update({ flags: { ...draft.flags, [f.key]: on } })} />
              ))}
            </div>
            <button type="button" onClick={() => setDraft(withSuggestedTags(draft))} className="mt-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
              Re-suggest allergens and flags from the names
            </button>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Shop aisle">
              <select value={draft.aisle} onChange={(e) => update({ aisle: e.target.value as AisleId })} className={inputClass}>
                {AISLES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sold by">
              <select value={draft.purchaseUnit} onChange={(e) => update({ purchaseUnit: e.target.value as PurchaseUnit })} className={inputClass}>
                <option value="g">Weight (g)</option>
                <option value="ml">Volume (ml)</option>
                <option value="piece">Piece</option>
              </select>
            </Field>
            <Field label={draft.purchaseUnit === "piece" ? "Pieces per pack" : `Pack size (${draft.purchaseUnit})`}>
              <input type="number" step="any" min="0" value={draft.packSize} onChange={(e) => update({ packSize: e.target.value })} className={inputClass} required />
            </Field>
            {draft.purchaseUnit === "piece" && (
              <Field label="Grams per piece">
                <input type="number" step="any" min="0" value={draft.gramsPerPiece} onChange={(e) => update({ gramsPerPiece: e.target.value })} className={inputClass} required />
              </Field>
            )}
            {draft.purchaseUnit === "ml" && (
              <Field label="Grams per ml (oil ≈ 0.92)">
                <input type="number" step="0.001" min="0.1" value={draft.gramsPerMl} onChange={(e) => update({ gramsPerMl: e.target.value })} className={inputClass} required />
              </Field>
            )}
            <Field label="Shop search word">
              <input value={draft.searchTerm} onChange={(e) => update({ searchTerm: e.target.value })} className={inputClass} required />
            </Field>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? "Saving…" : "Save ingredient"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-zinc-300 px-4 py-2 font-semibold dark:border-zinc-700">
              Back to results
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50 dark:border-zinc-800 dark:has-[:checked]:bg-emerald-950">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
      {label}
    </label>
  );
}
