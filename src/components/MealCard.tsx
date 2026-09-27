import SaveButton from "@/components/SaveButton";
import type { MealType } from "@/lib/nutrition";
import type { Recipe } from "@/lib/spoonacular";

// Spoonacular serves several sizes; the default 312x231 looks blurry on phones.
function largerImage(url: string): string {
  return url.replace(/-\d+x\d+\.(jpg|jpeg|png)$/i, "-556x370.$1");
}

interface MealCardProps {
  recipe: Recipe;
  mealType: MealType;
  saved: boolean;
}

export default function MealCard({ recipe, mealType, saved }: MealCardProps) {
  const stats = [
    { label: "kcal", value: recipe.calories },
    { label: "protein", value: `${recipe.proteinG} g` },
    { label: "carbs", value: `${recipe.carbsG} g` },
    { label: "fat", value: `${recipe.fatG} g` },
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 sm:flex dark:border-zinc-800">
      {recipe.imageUrl ? (
        // Plain <img>: Spoonacular already sizes images, and this avoids Vercel image-optimisation quotas.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={largerImage(recipe.imageUrl)}
          alt=""
          loading="lazy"
          className="aspect-[3/2] w-full bg-zinc-100 object-cover sm:aspect-auto sm:w-2/5 sm:shrink-0 dark:bg-zinc-800"
        />
      ) : (
        <div className="aspect-[3/2] w-full bg-zinc-100 sm:aspect-auto sm:w-2/5 sm:shrink-0 dark:bg-zinc-800" aria-hidden />
      )}

      <div className="p-4 sm:flex-1">
        <h3 className="text-lg font-semibold leading-snug">{recipe.title}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {[
            recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : null,
            `${recipe.servings} ${recipe.servings === 1 ? "serving" : "servings"}`,
            recipe.sourceName,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-lg bg-zinc-100 px-1 py-2 dark:bg-zinc-800">
              <dt className="text-xs text-zinc-600 dark:text-zinc-400">{s.label}</dt>
              <dd className="font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Per serving</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            View full recipe<span className="sr-only"> for {recipe.title} (opens in a new tab)</span> →
          </a>
          <SaveButton
            // key: reset the button's state when "Show another" swaps the recipe.
            key={recipe.id}
            recipe={{ recipeId: recipe.id, title: recipe.title, imageUrl: recipe.imageUrl, mealType }}
            initiallySaved={saved}
          />
        </div>
      </div>
    </article>
  );
}
