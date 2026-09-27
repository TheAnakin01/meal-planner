const features = [
  {
    title: "Your daily target",
    text: "Calories, protein, carbs and fat worked out from your age, body, activity and goal.",
  },
  {
    title: "Breakfast, lunch & dinner",
    text: "Recipe ideas sized to fit your calorie budget for each meal.",
  },
  {
    title: "Allergy-safe",
    text: "Recipes containing your allergens are filtered out, then double-checked.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-12 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
        Meal Planner
      </p>
      <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
        Meals that fit your body, your goal and your allergies.
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Tell us a little about yourself and get a personalised daily plan with recipe
        suggestions.
      </p>

      <button
        type="button"
        disabled
        className="mt-8 w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white opacity-60 sm:w-auto"
      >
        Get started (coming soon)
      </button>

      <ul className="mt-12 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <li
            key={f.title}
            className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.text}</p>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-xs text-zinc-500">
        Estimates only, not medical advice. Always check ingredient labels.
      </p>
    </main>
  );
}
