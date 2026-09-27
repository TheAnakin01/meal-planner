"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { saveProfile } from "@/app/profile/actions";
import { ALLERGENS, type AllergenId, parseOtherAllergies } from "@/lib/allergens";
import { DIET_TYPES } from "@/lib/diet";
import { feetInchesToCm, poundsToKg } from "@/lib/nutrition";
import { DEFAULT_STORE, STORES } from "@/lib/stores";
import { type ProfileField, type ProfileInput, isValidTimezone, profileSchema } from "@/lib/validation";

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

const inputClass = "input mt-1 aria-[invalid=true]:border-red-500";

// Empty input -> NaN so zod reports "Please enter ...".
const toNumber = (value: string) => (value.trim() === "" ? NaN : Number(value));

// Prefill imperial fields from saved metric values, in case the user switches units.
function toImperial(initial: Partial<ProfileInput>) {
  if (initial.heightCm === undefined || initial.weightKg === undefined) return { lb: "", ft: "", in: "" };
  const totalInches = Math.round(initial.heightCm / 2.54);
  return {
    lb: String(Math.round(initial.weightKg / 0.45359237)),
    ft: String(Math.floor(totalInches / 12)),
    in: String(totalInches % 12),
  };
}

const STORE_OPTIONS = STORES.map((s) => ({ value: s.id, label: s.name }));

// The phone's timezone, e.g. "Asia/Kolkata". Used later for "today" and meal reminders.
function detectTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz && isValidTimezone(tz) ? tz : "Asia/Kolkata";
}

export default function ProfileForm({ initial = {} }: { initial?: Partial<ProfileInput> }) {
  const imperial = toImperial(initial);
  const [units, setUnits] = useState<Units>("metric");
  const [age, setAge] = useState(initial.age !== undefined ? String(initial.age) : "");
  const [weightKg, setWeightKg] = useState(initial.weightKg !== undefined ? String(initial.weightKg) : "");
  const [heightCm, setHeightCm] = useState(initial.heightCm !== undefined ? String(initial.heightCm) : "");
  const [weightLb, setWeightLb] = useState(imperial.lb);
  const [heightFt, setHeightFt] = useState(imperial.ft);
  const [heightIn, setHeightIn] = useState(imperial.in);
  const [gender, setGender] = useState<string>(initial.gender ?? "");
  const [activityLevel, setActivityLevel] = useState<string>(initial.activityLevel ?? "");
  const [goal, setGoal] = useState<string>(initial.goal ?? "");
  const [allergies, setAllergies] = useState<AllergenId[]>(initial.allergies ?? []);
  const [otherAllergies, setOtherAllergies] = useState(initial.otherAllergies?.join(", ") ?? "");
  const [dietType, setDietType] = useState<string>(initial.dietType ?? "");
  const [preferredStore, setPreferredStore] = useState<string>(initial.preferredStore ?? DEFAULT_STORE);

  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, startSaving] = useTransition();

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
      dietType: dietType || undefined,
      preferredStore,
      timezone: detectTimezone(),
    });

    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ProfileField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      const firstField = Object.keys(next)[0];
      document.querySelector<HTMLElement>(`[data-field="${firstField}"]`)?.focus();
      return;
    }

    setErrors({});
    setSaveError("");
    startSaving(async () => {
      // On success the server redirects to /dashboard, so we only get here on failure.
      const result = await saveProfile(parsed.data);
      if (result?.error) setSaveError(result.error);
    });
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
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-600 dark:text-zinc-400">ft</span>
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
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-600 dark:text-zinc-400">in</span>
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

      <ChoiceGroup
        name="dietType"
        legend="Diet type"
        options={DIET_TYPES.map((d) => ({ value: d.id, label: d.label, hint: d.hint }))}
        value={dietType}
        onChange={setDietType}
        error={errors.dietType}
        columns="sm:grid-cols-2"
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
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 px-3 py-3 transition hover:border-emerald-400 active:scale-[0.98] has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 dark:border-zinc-800 dark:has-[:checked]:bg-emerald-950"
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
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 motion-safe:animate-fade-up dark:bg-red-950 dark:text-red-300">
          Please fix the highlighted fields above.
        </p>
      )}

      <ChoiceGroup
        name="preferredStore"
        legend="Where do you usually buy groceries online?"
        options={STORE_OPTIONS}
        value={preferredStore}
        onChange={setPreferredStore}
        error={errors.preferredStore}
        columns="grid-cols-2 sm:grid-cols-3"
      />

      {errors.timezone && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          We couldn&apos;t detect your timezone. Please check your phone&apos;s date and time settings.
        </p>
      )}

      {saveError && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 motion-safe:animate-fade-up dark:bg-red-950 dark:text-red-300">
          {saveError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary w-full px-6 py-4 text-base sm:w-auto"
      >
        {saving ? "Saving…" : "Save and see my plan"}
      </button>
    </form>
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
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition hover:border-emerald-400 active:scale-[0.98] has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:shadow-sm dark:has-[:checked]:bg-emerald-950 ${
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
