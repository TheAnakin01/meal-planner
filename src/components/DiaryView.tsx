"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import {
  type LookupResult,
  deleteLogAction,
  logBarcodeAction,
  logManualAction,
  logPlannedMealAction,
  lookupBarcodeAction,
} from "@/app/diary/actions";
import BarcodeScanner from "@/components/BarcodeScanner";
import { DIARY_MEALS, type DiaryEntry, type DiaryMeal } from "@/lib/diary";
import type { Nutrients } from "@/lib/library";
import { OFF_ATTRIBUTION, nutrientsForGrams } from "@/lib/openfoodfacts";

export interface PlannedToday {
  meal: "breakfast" | "lunch" | "dinner";
  title: string;
  portion: number;
  kcal: number;
  logged: boolean;
}

interface Props {
  date: string;
  entries: DiaryEntry[];
  totals: Nutrients;
  targetKcal: number;
  targetProteinG: number;
  planned: PlannedToday[]; // only for today
}

const MEAL_LABEL: Record<DiaryMeal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const inputClass = "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700";
const primary = "rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
const num = (s: string) => (s.trim() === "" ? 0 : Number(s));

function defaultMeal(): DiaryMeal {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack";
}

export default function DiaryView({ date, entries, totals, targetKcal, targetProteinG, planned }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [meal, setMeal] = useState<DiaryMeal>(defaultMeal);
  const [lookup, setLookup] = useState<Extract<LookupResult, { ok: true }> | null>(null);
  const [grams, setGrams] = useState("");
  const [manual, setManual] = useState({ label: "", amount: "", calories: "", protein: "", carbs: "", fat: "" });

  function run(task: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError("");
    if (!navigator.onLine) {
      setError("You're offline — logging food needs internet.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await task();
        if (!r.ok) setError(r.error ?? "Something went wrong.");
        else after?.();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function onBarcode(code: string) {
    setLookup(null);
    run(async () => {
      const r = await lookupBarcodeAction(code);
      if (r.ok) {
        setLookup(r);
        setGrams(String(r.product?.servingGrams ?? 100));
      }
      return r;
    });
  }

  function addManual(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        logManualAction({
          date,
          meal,
          label: manual.label,
          amount: manual.amount,
          calories: manual.calories.trim() === "" ? NaN : Number(manual.calories),
          proteinG: num(manual.protein),
          carbsG: num(manual.carbs),
          fatG: num(manual.fat),
        }),
      () => setManual({ label: "", amount: "", calories: "", protein: "", carbs: "", fat: "" }),
    );
  }

  const product = lookup?.product ?? null;
  const preview = product?.per100g && Number(grams) > 0 ? nutrientsForGrams(product.per100g, Number(grams)) : null;
  const pct = targetKcal > 0 ? Math.min(100, Math.round((totals.kcal / targetKcal) * 100)) : 0;

  return (
    <div className="space-y-6" aria-busy={pending}>
      <section aria-label="Totals" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-lg">
          <strong>{Math.round(totals.kcal).toLocaleString()}</strong> of {targetKcal.toLocaleString()} kcal eaten ·{" "}
          {Math.round(totals.proteinG)} of {targetProteinG} g protein
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="img" aria-label={`${pct}% of daily calories eaten`}>
          <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {planned.length > 0 && (
        <section aria-labelledby="planned" className="space-y-2">
          <h2 id="planned" className="text-lg font-bold">
            From today&apos;s plan
          </h2>
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {planned.map((p) => (
              <li key={p.meal} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-semibold">{MEAL_LABEL[p.meal]}:</span> {p.title} · {Math.round(p.kcal)} kcal
                </span>
                {p.logged ? (
                  <span className="text-emerald-700 dark:text-emerald-400">✓ Logged</span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => run(() => logPlannedMealAction(p.meal))} className="rounded-lg border border-zinc-300 px-3 py-1 font-medium disabled:opacity-60 dark:border-zinc-700">
                    I ate this<span className="sr-only"> ({MEAL_LABEL[p.meal]})</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {DIARY_MEALS.map((m) => {
        const items = entries.filter((e) => e.meal === m);
        if (items.length === 0) return null;
        return (
          <section key={m} aria-labelledby={`log-${m}`}>
            <h2 id={`log-${m}`} className="font-bold">
              {MEAL_LABEL[m]}
            </h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {items.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{e.label}</span>
                    <span className="block text-zinc-600 dark:text-zinc-400">
                      {e.amount && `${e.amount} · `}
                      {Math.round(e.calories)} kcal · P {Math.round(e.proteinG)} g
                    </span>
                  </span>
                  <button type="button" disabled={pending} onClick={() => run(() => deleteLogAction(e.id))} className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400">
                    Remove<span className="sr-only"> {e.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="add-food" className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 id="add-food" className="text-lg font-bold">
          Add food
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" role="group" aria-label="How to add">
            {(["scan", "manual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
              >
                {m === "scan" ? "Packaged (barcode)" : "Type it in"}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium">
            Meal
            <select value={meal} onChange={(e) => setMeal(e.target.value as DiaryMeal)} className={inputClass}>
              {DIARY_MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "scan" ? (
          <div className="space-y-4">
            <BarcodeScanner onBarcode={onBarcode} disabled={pending} />
            {lookup && !product && (
              <p role="status" className="text-sm">
                This barcode isn&apos;t in Open Food Facts yet. Use <strong>Type it in</strong> with the numbers from the pack.
              </p>
            )}
            {product && (
              <div className="space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                <p className="font-semibold">
                  {product.brand && `${product.brand} · `}
                  {product.name}
                </p>
                {lookup?.warnings && lookup.warnings.contains.length > 0 && (
                  <Warn tone="red">⚠️ Contains {lookup.warnings.contains.join(", ")} — on your allergy list. Don&apos;t eat this.</Warn>
                )}
                {lookup?.warnings && lookup.warnings.mayContain.length > 0 && (
                  <Warn tone="amber">May contain traces of {lookup.warnings.mayContain.join(", ")}.</Warn>
                )}
                {lookup?.warnings?.unknownIngredients && (
                  <Warn tone="amber">No ingredient list in the database — check the pack yourself.</Warn>
                )}
                {product.per100g ? (
                  <>
                    <label className="block text-sm font-medium">
                      Grams eaten
                      <input type="number" min={1} max={5000} inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={inputClass} />
                    </label>
                    {preview && (
                      <p className="text-sm">
                        {preview.kcal} kcal · Protein {preview.proteinG} g · Carbs {preview.carbsG} g · Fat {preview.fatG} g
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={pending || !preview}
                      onClick={() => run(() => logBarcodeAction({ barcode: product.barcode, grams: Number(grams), meal, date }), () => setLookup(null))}
                      className={primary}
                    >
                      Add to diary
                    </button>
                  </>
                ) : (
                  <p className="text-sm">No nutrition data for this product — please use &ldquo;Type it in&rdquo;.</p>
                )}
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{OFF_ATTRIBUTION}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={addManual} className="grid gap-3 sm:grid-cols-2">
            <Field label="What did you eat?">
              <input value={manual.label} onChange={(e) => setManual({ ...manual, label: e.target.value })} maxLength={120} required className={inputClass} />
            </Field>
            <Field label="How much (optional)">
              <input value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} maxLength={40} placeholder="e.g. 1 bowl" className={inputClass} />
            </Field>
            <Field label="Calories (kcal)">
              <input type="number" min={0} inputMode="decimal" value={manual.calories} onChange={(e) => setManual({ ...manual, calories: e.target.value })} required className={inputClass} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              {(["protein", "carbs", "fat"] as const).map((k) => (
                <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} g`}>
                  <input type="number" min={0} inputMode="decimal" value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} className={inputClass} />
                </Field>
              ))}
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className={primary}>
                Add to diary
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
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

function Warn({ tone, children }: { tone: "red" | "amber"; children: ReactNode }) {
  return (
    <p
      role="alert"
      className={`rounded-lg p-2 text-sm ${
        tone === "red" ? "bg-red-50 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      }`}
    >
      {children}
    </p>
  );
}
