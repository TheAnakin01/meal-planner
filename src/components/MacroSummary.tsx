import type { NutritionPlan } from "@/lib/nutrition";

interface MacroSummaryProps {
  plan: NutritionPlan;
  excluding: string[];
}

export default function MacroSummary({ plan, excluding }: MacroSummaryProps) {
  const { proteinG, carbsG, fatG } = plan.macros;
  const macros = [
    { name: "Protein", grams: proteinG, kcal: proteinG * 4, color: "bg-sky-500" },
    { name: "Carbs", grams: carbsG, kcal: carbsG * 4, color: "bg-amber-500" },
    { name: "Fat", grams: fatG, kcal: fatG * 9, color: "bg-rose-500" },
  ];
  const macroKcal = macros.reduce((sum, m) => sum + m.kcal, 0);

  return (
    <section aria-label="Your daily targets" className="space-y-4">
      <div className="rounded-xl bg-emerald-700 p-5 text-white">
        <p className="text-sm font-medium opacity-90">Daily calorie target</p>
        <p className="mt-1 text-4xl font-bold">
          {plan.calories.toLocaleString()} <span className="text-lg font-semibold">kcal</span>
        </p>
        <p className="mt-2 text-sm opacity-90">
          Your body uses about {plan.tdee.toLocaleString()} kcal a day at your activity level.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">Macros</h2>
        <div
          className="mt-3 flex h-3 overflow-hidden rounded-full"
          role="img"
          aria-label={`Protein ${proteinG} g, carbs ${carbsG} g, fat ${fatG} g`}
        >
          {macros.map((m) => (
            <div key={m.name} className={m.color} style={{ width: `${(m.kcal / macroKcal) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
          {macros.map((m) => (
            <li key={m.name}>
              <span className={`mx-auto mb-1 block h-2 w-2 rounded-full ${m.color}`} aria-hidden />
              <span className="block text-2xl font-bold">{m.grams} g</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{m.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {excluding.length > 0 && (
        <p className="text-sm">
          <span className="font-semibold">Excluding:</span> {excluding.join(", ")}
        </p>
      )}
    </section>
  );
}
