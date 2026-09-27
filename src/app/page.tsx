import Link from "next/link";
import { CartIcon, ChatIcon, DiaryIcon, LeafIcon, ShieldIcon, WeekIcon } from "@/components/ui/icons";
import { MEAL_STYLE, MealIcon } from "@/components/meal-ui";

const features = [
  { icon: WeekIcon, title: "A week of meals", text: "Breakfast, lunch and dinner for 7 days, sized to your calorie target.", tint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { icon: ShieldIcon, title: "Allergy-safe", text: "16 allergens plus your own words, checked twice on every recipe.", tint: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  { icon: CartIcon, title: "Shopping list", text: "Built for you, rounded to packs, with Blinkit, Zepto & BigBasket links.", tint: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { icon: DiaryIcon, title: "Food diary", text: "Log meals in one tap or scan a barcode on packaged food.", tint: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { icon: ChatIcon, title: "AI coach", text: "Ask questions and get swaps that respect your diet and allergies.", tint: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  { icon: LeafIcon, title: "Indian diets", text: "Vegetarian, eggetarian, vegan, Jain and non-veg — all built in.", tint: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
];

const steps = ["Tell us your age, body, goal and allergies", "Get your calorie target and a week of meals", "Shop, cook, and tick things off"];

// A small, static picture of the app for the hero (decorative).
const preview = [
  { meal: "breakfast" as const, title: "Vegetable Poha", kcal: 410 },
  { meal: "lunch" as const, title: "Rajma Chawal", kcal: 620 },
  { meal: "dinner" as const, title: "Palak Paneer with Roti", kcal: 700 },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-16 sm:pt-16">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="stagger">
          <p className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Free · no ads · works offline</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Meals that fit your body, your goal and{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">your allergies.</span>
          </h1>
          <p className="mt-4 text-lg muted">
            A personal weekly meal plan for Indian kitchens — with a shopping list, food diary and an AI coach.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="btn btn-primary px-8 py-4 text-base">
              Get started — it&apos;s free
            </Link>
            <Link href="/login" className="btn btn-secondary px-8 py-4 text-base">
              I have an account
            </Link>
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto w-full max-w-sm">
          <span className="absolute -left-6 top-6 h-40 w-40 rounded-full bg-emerald-300/30 blur-2xl motion-safe:animate-float" />
          <span className="absolute -right-4 bottom-4 h-40 w-40 rounded-full bg-amber-300/30 blur-2xl motion-safe:animate-float [animation-delay:-3s]" />
          <div className="relative rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-2xl motion-safe:animate-fade-up dark:border-zinc-800 dark:bg-zinc-900">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white">
              <p className="text-xs text-emerald-100">Tuesday</p>
              <p className="text-xl font-bold">Good morning</p>
              <p className="mt-3 text-3xl font-bold">
                1,730 <span className="text-sm font-medium text-emerald-100">of 1,900 kcal</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-white/20">
                <div className="h-full w-[91%] rounded-full bg-white" />
              </div>
            </div>
            <ul className="stagger mt-3 space-y-2">
              {preview.map((p) => (
                <li key={p.meal} className="flex items-center gap-3 rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${MEAL_STYLE[p.meal].badge}`}>
                    <MealIcon meal={p.meal} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide muted">{MEAL_STYLE[p.meal].label}</span>
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                  </span>
                  <span className="chip">{p.kcal} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="features" className="mt-20">
        <h2 id="features" className="text-center text-2xl font-bold tracking-tight">
          Everything in one place
        </h2>
        <ul className="stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text, tint }) => (
            <li key={title} className="card transition hover:-translate-y-1 hover:shadow-lg">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tint}`}>
                <Icon size={22} />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mt-20">
        <h2 id="how" className="text-center text-2xl font-bold tracking-tight">
          How it works
        </h2>
        <ol className="stagger mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="card text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-700 font-bold text-white">{i + 1}</span>
              <p className="mt-3 text-sm font-medium">{s}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="/dashboard" className="btn btn-dark px-8 py-4 text-base">
            Start planning
          </Link>
        </div>
      </section>

      <p className="mt-16 text-center text-xs muted">Estimates only, not medical advice. Always check ingredient labels.</p>
    </main>
  );
}
