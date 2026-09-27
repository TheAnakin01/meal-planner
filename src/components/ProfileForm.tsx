"use client";

import { type FormEvent, type ReactNode, useRef, useState } from "react";
import MacroSummary from "@/components/MacroSummary";
import { ALLERGENS, type AllergenId, allergenLabel, parseOtherAllergies } from "@/lib/allergens";
import {
  type NutritionPlan,
  calculateNutritionPlan,
  feetInchesToCm,
  poundsToKg,
} from "@/lib/nutrition";
import { type ProfileField, type ProfileInput, profileSchema } from "@/lib/validation";

type Units = "metric" | "imperial";
type Errors = Partial<Record<ProfileField, string>>;

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other / prefer not to say" },
] as const;

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", hint: "Little or no exercise" },
  { value: "light", label: "Lightly active", hint: "Exercise 1–3 days a week" },
  { value: "moderate", label: "Moderately active", hint: "Exercise 3–5 days a week" },
  { value: "active", label: "Very active", hint: "Exercise 6–7 days a week" },
  { value: "very_active", label: "Extremely active", hint: "Hard daily exercise or a physical job" },
] as const;

const GOALS = [
  { value: "lose", label: "Lose weight" },
  { value: "maintain", label: "Maintain" },
  { value: "gain", label: "Gain weight" },
] as const;

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base " +
  "focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 " +
  "aria-[invalid=true]:border-red-500 dark:border-zinc-700";

// Empty input -> NaN so zod reports "Please enter ...".
const toNumber = (value: string) => (value.trim() === "" ? NaN : Number(value));

export default function ProfileForm() {
  const [units, setUnits] = useState<Units>("metric");
  const [age, setAge] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [gender, setGender] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [allergies, setAllergies] = useState<AllergenId[]>([]);
  const [otherAllergies, setOtherAllergies] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<{ plan: NutritionPlan; profile: ProfileInput } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function toggleAllergy(id: AllergenId) {
    setAllergies((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const weight =
      units === "metric" ? toNumber(weightKg) : poundsToKg(toNumber(weightLb));
    const height =
      units === "metric"
        ? toNumber(heightCm)
        : feetInchesToCm(toNumber(heightFt), heightIn.trim() === "" ? 0 : toNumber(heightIn));

    const parsed = profileSchema.safeParse({
      age: toNumber(age),
      weightKg: weight,
      heightCm: height,
      gender: gender || undefined,
      activityLevel: activityLevel || undefined,
      goal: goal || undefined,
      allergies,
      otherAllergies: parseOtherAllergies(otherAllergies),
    });

    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ProfileField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      setResult(null);
      const firstField = Object.keys(next)[0];
      document.querySelector<HTMLElement>(`[data-field="${firstField}"]`)?.focus();
      return;
    }

    setErrors({});
    setResult({ plan: calculateNutritionPlan(parsed.data), profile: parsed.data });
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  const unitButton = (value: Units, label: string) => (
    <button
      type="button"
      onClick={() => setUnits(value)}
      aria-pressed={units === value}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
        units === value
          ? "bg-white shadow-sm dark:bg-zinc-700"
          : "text-zinc-600 dark:text-zinc-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" role="group" aria-label="Units">
          {unitButton("metric", "Metric (kg, cm)")}
          {unitButton("imperial", "Imperial (lb, ft)")}
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="age" label="Age" error={errors.age}>
            <input
              id="age"
              data-field="age"
              type="number"
              inputMode="numeric"
              min={16}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-invalid={!!errors.age}
              aria-describedby={errors.age ? "age-error" : undefined}
              className={inputClass}
            />
          </Field>

          {units === "metric" ? (
            <>
              <Field id="weightKg" label="Weight (kg)" error={errors.weightKg}>
                <input
                  id="weightKg"
                  data-field="weightKg"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  aria-invalid={!!errors.weightKg}
                  aria-describedby={errors.weightKg ? "weightKg-error" : undefined}
                  className={inputClass}
                />
              </Field>
              <Field id="heightCm" label="Height (cm)" error={errors.heightCm}>
                <input
                  id="heightCm"
                  data-field="heightCm"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  aria-invalid={!!errors.heightCm}
                  aria-describedby={errors.heightCm ? "heightCm-error" : undefined}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <>
              <Field id="weightKg" label="Weight (lb)" error={errors.weightKg}>
                <input
                  id="weightKg"
                  data-field="weightKg"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weightLb}
                  onChange={(e) => setWeightLb(e.target.value)}
                  aria-invalid={!!errors.weightKg}
                  aria-describedby={errors.weightKg ? "weightKg-error" : undefined}
                  className={inputClass}
                />
              </Field>
              <Field id="heightCm" label="Height" error={errors.heightCm} asGroup>
                <div className="mt-1 flex gap-2">
                  <label className="flex-1">
                    <span className="sr-only">Feet</span>
                    <div className="relative">
                      <input
                        id="heightCm"
                        data-field="heightCm"
                        type="number"
                        inputMode="numeric"
                        value={heightFt}
                        onChange={(e) => setHeightFt(e.target.value)}
                        aria-label="Height, feet"
                        aria-invalid={!!errors.heightCm}
                        aria-describedby={errors.heightCm ? "heightCm-error" : undefined}
                        className={`${inputClass} mt-0 pr-9`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">ft</span>
                    </div>
                  </label>
                  <label className="flex-1">
                    <span className="sr-only">Inches</span>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={heightIn}
                        onChange={(e) => setHeightIn(e.target.value)}
                        aria-label="Height, inches"
                        aria-invalid={!!errors.heightCm}
                        className={`${inputClass} mt-0 pr-9`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">in</span>
                    </div>
                  </label>
                </div>
              </Field>
            </>
          )}
        </div>

        <ChoiceGroup
          name="gender"
          legend="Gender"
          options={GENDERS}
          value={gender}
          onChange={setGender}
          error={errors.gender}
          columns="sm:grid-cols-3"
        />

        <ChoiceGroup
          name="activityLevel"
          legend="Activity level"
          options={ACTIVITY_LEVELS}
          value={activityLevel}
          onChange={setActivityLevel}
          error={errors.activityLevel}
        />

        <ChoiceGroup
          name="goal"
          legend="Goal"
          options={GOALS}
          value={goal}
          onChange={setGoal}
          error={errors.goal}
          columns="grid-cols-3"
        />

        <fieldset>
          <legend className="font-semibold">Allergies</legend>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tick everything you must avoid. Recipes containing these will never be shown.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ALLERGENS.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-3 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 dark:border-zinc-800 dark:has-[:checked]:bg-emerald-950"
              >
                <input
                  type="checkbox"
                  checked={allergies.includes(a.id)}
                  onChange={() => toggleAllergy(a.id)}
                  className="h-5 w-5 accent-emerald-600"
                />
                <span className="text-sm">{a.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <Field id="otherAllergies" label="Other allergies (optional)" error={errors.otherAllergies}>
              <input
                id="otherAllergies"
                data-field="otherAllergies"
                type="text"
                placeholder="e.g. kiwi, strawberry"
                value={otherAllergies}
                onChange={(e) => setOtherAllergies(e.target.value)}
                aria-invalid={!!errors.otherAllergies}
                aria-describedby={errors.otherAllergies ? "otherAllergies-error" : "otherAllergies-hint"}
                className={inputClass}
              />
              <p id="otherAllergies-hint" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Separate with commas.
              </p>
            </Field>
          </div>
        </fieldset>

        {Object.keys(errors).length > 0 && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Please fix the highlighted fields above.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-600/40 sm:w-auto"
        >
          {result ? "Recalculate my plan" : "Calculate my plan"}
        </button>
      </form>

      {result && (
        <div ref={resultRef} className="scroll-mt-4">
          <MacroSummary
            plan={result.plan}
            excluding={[
              ...result.profile.allergies.map(allergenLabel),
              ...result.profile.otherAllergies,
            ]}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  error,
  asGroup = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  asGroup?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      {asGroup ? (
        <span className="block font-semibold">{label}</span>
      ) : (
        <label htmlFor={id} className="block font-semibold">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  columns = "",
}: {
  name: string;
  legend: string;
  options: readonly { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  columns?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="font-semibold">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {options.map((o, i) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950 ${
              error ? "border-red-500" : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              data-field={i === 0 ? name : undefined}
              className="h-5 w-5 shrink-0 accent-emerald-600"
            />
            <span>
              <span className="block text-sm font-medium">{o.label}</span>
              {o.hint && (
                <span className="block text-xs text-zinc-600 dark:text-zinc-400">{o.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
