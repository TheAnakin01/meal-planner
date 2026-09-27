# Meal Planner

A free, mobile-friendly meal planning app for India: it works out your daily calories and macros, plans a week of
**allergy-safe** breakfasts, lunches and dinners, builds your shopping list with one-tap "buy" links to Indian
grocery apps, and works offline as an installable app.

**Live:** https://meal-planner-pied-beta.vercel.app · **Full spec & roadmap:** [CLAUDE.md](CLAUDE.md)

## Features

- **Personal targets** — calories, protein, carbs and fat from age, weight, height, activity and goal (lose / maintain / gain).
- **Strict allergen safety** — 16 allergens plus your own words, checked twice (ingredient tags *and* a word check)
  everywhere: recipes, plans, swaps, barcode scans and AI replies.
- **Indian diet types** — vegetarian, eggetarian, vegan, Jain and non-vegetarian.
- **Weekly meal plan** — a tap-a-day picker with animated calorie rings; portions scaled to your targets,
  variety rules, leftovers mode, swap / lock / regenerate. Motion respects "reduce motion" settings.
- **Shopping list** — combined quantities rounded to pack sizes, grouped by aisle, pantry, WhatsApp share and "Buy on"
  links for BigBasket, Blinkit, Zepto, Swiggy Instamart, Amazon.in and JioMart.
- **Recipe library** — admin editor with live nutrition from USDA FoodData Central, AI-drafted recipes (Gemini) that a
  human reviews before publishing, and allergen-safe "swap ideas" for ingredients.
- **AI nutrition coach** — opt-in chat (Gemini free tier) that knows your targets, diet, allergies and plan; can propose
  meal swaps and shopping items that you confirm. Sends no name, email, weight or height.
- **Food diary** — log planned meals in one tap, scan packaged food barcodes (Open Food Facts) with allergy warnings.
- **Progress** — calorie-vs-target and weight charts, streaks and weekly averages.
- **Installable & offline** — add to your home screen; Today, Week and your shopping list work without internet and
  ticks sync later.
- **Meal reminders** — optional push notifications at your meal times.
- **Household sharing** — invite family with a code; everyone keeps their own plan and allergies, and shares one
  combined shopping list that updates live on every phone. Members see only each other's chosen names.
- **Discover** — extra recipe ideas from Spoonacular.

## Tech stack (all free tiers)

Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, Row Level Security, Realtime, pg_cron) · Vercel Hobby ·
USDA FoodData Central · Open Food Facts · Google Gemini (free tier) · Spoonacular (free tier) · Vitest.

## Run it on your computer

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Other commands: `npm test` (unit tests), `npm run lint`, `npm run build`.

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | What it's for | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | no |
| `SPOONACULAR_API_KEY` | Discover page recipes | yes |
| `USDA_FDC_API_KEY` | Ingredient nutrition (admin) | yes |
| `GEMINI_API_KEY` | AI coach and recipe drafting | yes |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Meal reminders (web push) | no |
| `VAPID_PRIVATE_KEY` | Meal reminders (web push) | yes |
| `CRON_SECRET` | Lets the scheduler trigger reminders | yes |

Add the same variables in Vercel → Settings → Environment Variables, then redeploy.

### Database

Run the files in `supabase/migrations/` **in order** (0001 → latest) in the Supabase SQL Editor. For reminders, also
enable the `pg_cron` and `pg_net` extensions and run the scheduler SQL kept locally in `supabase/local/`
(git-ignored because it contains a secret).

**Starter recipes (optional, recommended):** run `supabase/seed/starter-library.sql` once in the SQL Editor. It adds
64 ingredients (USDA nutrition) and 79 Indian recipes as drafts. Then open **Admin → Recipes → Publish ready drafts**.
To change the starter data, edit `supabase/seed/starter-library.ts` and run `npm run seed:build`.

## Security

Every table uses Row Level Security, so people only ever see their own data (and their household's shared list).
Secret keys stay on the server, the reminder scheduler is protected by a secret, and the site sends standard browser
security headers.

## Data sources & credits

- Recipes (Discover) powered by [spoonacular](https://spoonacular.com/food-api).
- Nutrition data from [USDA FoodData Central](https://fdc.nal.usda.gov/) (public domain).
- Packaged food data from [Open Food Facts](https://openfoodfacts.org), available under the ODbL.

## Disclaimer

Calorie, nutrient and allergen information are estimates and can be wrong. Always check food labels. This app does not
give medical advice — talk to a doctor or registered dietitian about health conditions.

## License

[MIT](LICENSE) © 2026 TheAnakin01
