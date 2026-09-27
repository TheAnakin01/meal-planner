@AGENTS.md

# Meal Planner — Project Spec & Build Guide

> This file is the single source of truth for this project. Claude Code reads it
> automatically at the start of every session. Keep it up to date as the app evolves.

## 0. Ground rules (read first)

1. **Zero cost, always.** The owner has ordered that no money is spent and nothing is purchased.
   - Use only free tiers: GitHub Free, Vercel **Hobby**, Supabase **Free**, Spoonacular **Free** (signed up on spoonacular.com, not RapidAPI).
   - **Never** enter a credit card, never click "Upgrade", "Pro", "Start trial" or anything that needs payment details.
   - If a service asks for a card or has no free tier, **stop and tell the owner**, then switch to a free alternative
     (see §4.4 fallback), rather than paying.
   - Don't add paid npm packages, paid fonts or paid image services.
2. **The owner has zero coding knowledge.** Explain every step in plain language. When something must be clicked in a
   website (GitHub, Supabase, Vercel, Spoonacular), give numbered click-by-click instructions.
3. **Secrets never go in Git.** API keys live only in `.env.local` (local) and in Vercel's Environment Variables
   (production). `.env*.local` is git-ignored.
4. **Allergen safety is strict.** A recipe that might contain a user's allergen must never be shown (see §5.3).
5. Mobile-first design: every screen must work at 360px wide with no sideways scrolling.

## 1. What the app does

A web app that:

1. Lets a user sign up / log in (email + password or magic link) via Supabase Auth.
2. Collects a profile: **age, weight, height, gender, activity level, goal (lose / maintain / gain), allergies**.
3. Calculates **daily calorie target** and **macros** (protein, carbs, fat in grams).
4. Recommends **breakfast, lunch and dinner** recipes from the **Spoonacular Food API** that fit the calorie
   budget and **strictly exclude the user's allergens**.
5. Saves the profile (and optionally favourite recipes) in Supabase so the user sees their plan next time.

### Out of scope for v1
Payments, grocery lists, meal logging/tracking, social features, native mobile apps.

## 2. Tech stack

| Layer            | Choice                                          | Cost              |
|------------------|-------------------------------------------------|-------------------|
| Framework        | Next.js (latest stable, **App Router**, TypeScript) | Free          |
| Styling          | Tailwind CSS                                    | Free              |
| Forms/validation | `zod` (+ React Hook Form optional)              | Free              |
| Auth + Database  | Supabase (Postgres + Auth), `@supabase/ssr`, `@supabase/supabase-js` | Free tier |
| Recipes          | Spoonacular Food API (`recipes/complexSearch`)  | Free (50 points/day) |
| Hosting          | Vercel Hobby plan, auto-deploy from GitHub      | Free              |
| Source control   | Git + GitHub (public or private repo)           | Free              |
| Tests            | Vitest (unit tests for calculations & allergen filter) | Free       |

Node.js 20+ is required (installed: v24).

## 3. Folder structure

```
Meal_Planner/
├── CLAUDE.md                  # this file
├── README.md                  # short human-friendly intro + how to run
├── .gitignore
├── .env.example               # lists required env vars with empty values (committed)
├── .env.local                 # real secrets (NOT committed)
├── package.json
├── next.config.ts
├── tsconfig.json
├── public/                    # icons, logo, favicon
├── supabase/
│   └── migrations/
│       └── 0001_init.sql      # tables + Row Level Security policies (§6)
├── src/
│   ├── proxy.ts               # (Next 16 name for middleware) refreshes Supabase session, protects /dashboard & /profile
│   ├── app/
│   │   ├── layout.tsx         # root layout, fonts, mobile viewport
│   │   ├── page.tsx           # landing page
│   │   ├── globals.css
│   │   ├── login/page.tsx     # sign in / sign up
│   │   ├── auth/callback/route.ts   # Supabase email-link callback
│   │   ├── profile/page.tsx   # profile form (age, weight, ...)
│   │   └── dashboard/
│   │       ├── page.tsx       # calories, macros, meal recommendations (fetches recipes server-side)
│   │       └── saved/         # saved recipes page + save/unsave server action
│   ├── components/
│   │   ├── ProfileForm.tsx
│   │   ├── MacroSummary.tsx
│   │   ├── MealCard.tsx
│   │   ├── MealSection.tsx
│   │   └── ui/                # Button, Input, Select, Card, Spinner...
│   ├── lib/
│   │   ├── nutrition.ts       # BMR / TDEE / calorie & macro maths (§5.1, §5.2)
│   │   ├── allergens.ts       # allergy list + Spoonacular mapping (§5.3 layer 1)
│   │   ├── allergen-safety.ts # keyword + flag double-check on every recipe (§5.3 layer 2)
│   │   ├── spoonacular.ts     # Spoonacular request builder + response parsing (pure, tested)
│   │   ├── recipes.ts         # server-only Spoonacular fetch: key, 1-hour cache, errors, layer-2 filter
│   │   ├── validation.ts      # zod schemas for the profile form
│   │   └── supabase/
│   │       ├── client.ts      # browser client
│   │       └── server.ts      # server client (cookies)
│   └── types/
│       └── index.ts           # Profile, Recipe, MealPlan types
└── tests/
    ├── nutrition.test.ts
    └── allergens.test.ts
```

## 4. External services setup (all free)

### 4.1 GitHub
- Account at github.com (free). Repo name: `meal-planner`.

### 4.2 Supabase (Free plan)
1. supabase.com → Sign in with GitHub → **New project** → choose the **Free** plan, any region close to users, set a
   database password (the owner stores it in a password manager, never in chat or Git).
2. Project Settings → API → copy **Project URL** and **Publishable key** (`sb_publishable_...`; older projects call it the anon key) into `.env.local`.
3. SQL Editor → run `supabase/migrations/0001_init.sql`.
4. Authentication → URL Configuration → add `http://localhost:3000` and the Vercel URL to Redirect URLs.
- Note: free projects pause after ~1 week of no activity; just click "Restore" in the dashboard (free).
- **Project URL:** https://objczgfykwqthlcpgyyz.supabase.co (migration 0001 applied; Site URL + redirect URLs set for localhost:3000 and the Vercel URL).

### 4.3 Spoonacular (recipe API)
1. spoonacular.com/food-api/console → sign up **directly on spoonacular.com** (NOT via RapidAPI — RapidAPI asks for a
   card and can bill overages). The **Free** plan needs no card.
2. Console → **Profile** → copy the **API key** into `.env.local` and Vercel as `SPOONACULAR_API_KEY`.
3. Free plan limits: **50 points/day** (resets midnight UTC), 1 request/second. When used up the API returns
   **HTTP 402** until reset — it never charges. Each meal search costs ≈ 1.4 points (measured, §5.4), so ≈ 12 plan views/day.
4. Terms (spoonacular.com/food-api/terms, read 2026-09-27):
   - A **backlink to spoonacular is required** on the free plan (site footer: "Recipes powered by spoonacular").
   - **Caching API responses (max 1 hour) needs spoonacular's prior written permission.** We have none, so the app
     does **not** cache (`cache: "no-store"`). Each plan view costs ≈ 4 points. If the owner gets written permission,
     switch back to `next: { revalidate: 3600 }` in `src/lib/recipes.ts`.
   - Only the **recipe id, title and image URL** may be stored permanently (used for saved recipes). Never store
     ingredients, nutrition, instructions or source URLs.

### 4.4 Why not Edamam (decision, 2026-09-27)
The original spec used Edamam. Checked developer.edamam.com on 2026-09-27: **no free plan** (cheapest is $9/month,
prepaid), which breaks rule §0.1. The owner chose Spoonacular's free plan. TheMealDB was rejected (no nutrition data or
allergy labels). All provider code lives in `src/lib/recipes.ts` so it can be swapped later.

### 4.5 Vercel (Hobby plan)
1. vercel.com → Continue with GitHub → **Hobby** (free) → Import the `meal-planner` repo.
2. Add environment variables (§7) in Project → Settings → Environment Variables.
3. Every `git push` to `main` auto-deploys. Never enable paid add-ons.
4. **Live URL:** https://meal-planner-pied-beta.vercel.app

## 5. Core logic

### 5.1 Calories (Mifflin–St Jeor)
Inputs in metric (UI may offer kg/lb and cm/ft-in, converting to metric before saving).

```
BMR (male)   = 10·weight_kg + 6.25·height_cm − 5·age + 5
BMR (female) = 10·weight_kg + 6.25·height_cm − 5·age − 161
BMR (other / prefer not to say) = average of male and female formulas (−78)
```

Activity multipliers (TDEE = BMR × multiplier):

| Level          | Description                        | × |
|----------------|------------------------------------|------|
| sedentary      | little/no exercise                 | 1.2  |
| light          | 1–3 days/week                      | 1.375|
| moderate       | 3–5 days/week                      | 1.55 |
| active         | 6–7 days/week                      | 1.725|
| very_active    | hard daily exercise / physical job | 1.9  |

Goal adjustment:
- **lose**: TDEE − 500 kcal
- **maintain**: TDEE
- **gain**: TDEE + 300 kcal

Safety floor: never recommend below **1200 kcal (female/other)** or **1500 kcal (male)**. Round to nearest 10.
Show a disclaimer: "Estimates only, not medical advice. Consult a professional."

Input validation: age 16–100 (app not for children), weight 30–300 kg, height 120–230 cm.

### 5.2 Macros
- **Protein**: lose 2.0 g/kg, maintain 1.6 g/kg, gain 1.8 g/kg bodyweight (cap at 35% of calories).
- **Fat**: 25% of calories (÷ 9 kcal/g).
- **Carbs**: remaining calories (÷ 4 kcal/g).
Round grams to whole numbers.

Meal split of daily calories: **breakfast 25%, lunch 35%, dinner 40%**. For each meal, search recipes whose
calories **per serving** are within ±15% of that meal's target.

### 5.3 Allergen handling (STRICT — two layers)
Supported allergies (checkbox list). The stored ID (in `profiles.allergies`) is kept from the original Edamam-based
design; `allergens.ts` maps each to Spoonacular:

| Allergy     | Stored ID          | Spoonacular `intolerances` | Spoonacular `excludeIngredients` |
|-------------|--------------------|----------------------------|----------------------------------|
| Peanuts     | `peanut-free`      | `peanut`                   |                                  |
| Tree nuts   | `tree-nut-free`    | `tree nut`                 |                                  |
| Dairy/milk  | `dairy-free`       | `dairy`                    |                                  |
| Eggs        | `egg-free`         | `egg`                      |                                  |
| Soy         | `soy-free`         | `soy`                      |                                  |
| Wheat       | `wheat-free`       | `wheat`                    |                                  |
| Gluten      | `gluten-free`      | `gluten`                   |                                  |
| Fish        | `fish-free`        | `seafood`                  |                                  |
| Shellfish   | `shellfish-free`   | `shellfish`                |                                  |
| Crustaceans | `crustacean-free`  | `shellfish`                |                                  |
| Molluscs    | `mollusk-free`     | `shellfish`                |                                  |
| Sesame      | `sesame-free`      | `sesame`                   |                                  |
| Mustard     | `mustard-free`     | —                          | `mustard`                        |
| Celery      | `celery-free`      | —                          | `celery,celeriac`                |
| Lupin       | `lupine-free`      | —                          | `lupin,lupine`                   |
| Sulphites   | `sulfite-free`     | `sulfite`                  |                                  |

Plus a free-text "Other allergies" field (comma-separated words, e.g. "kiwi, strawberry").

1. **Layer 1 (API filter):** send the mapped `intolerances` and `excludeIngredients` (including free-text allergies).
2. **Layer 2 (our own double-check, server-side):** after results come back, reject any recipe where
   - a Spoonacular flag contradicts the allergy (e.g. dairy selected but `dairyFree` is false; gluten/wheat selected
     but `glutenFree` is false), **or**
   - any ingredient name (`nutrition.ingredients[].name`) or the recipe title contains a keyword from that allergen's keyword list in
     `allergen-safety.ts` (e.g. dairy → milk, butter, cheese, cream, yogurt, whey, casein, ghee; wheat → flour, bread, pasta,
     couscous, semolina...; case-insensitive, word match), or any free-text allergy word.
   **Why layer 2 is essential:** a real test on 2026-09-27 with `intolerances=dairy` returned 6 recipes, 2 of which
   Spoonacular itself flagged `dairyFree: false` (breakfast sausage; chocolate chips). The API filter alone is NOT safe.
3. If no safe recipes remain for a meal, show "No safe recipes found — try again" rather than an unsafe one.
4. Unit tests in `tests/allergens.test.ts` must prove unsafe recipes are removed.
5. UI disclaimer: "Always check ingredient labels; data comes from third parties."

### 5.4 Spoonacular request (server-side only, `src/lib/recipes.ts`, called from the dashboard page)
```
GET https://api.spoonacular.com/recipes/complexSearch
  ?apiKey=$SPOONACULAR_API_KEY          (server-only env var; never sent to the browser)
  &type=breakfast | main course         (lunch and dinner both use "main course")
  &minCalories=MIN&maxCalories=MAX      (per serving, ±15% of the meal target)
  &intolerances=peanut,dairy,...        (mapped, §5.3)
  &excludeIngredients=mustard,kiwi,...  (mapped + free-text allergies)
  &addRecipeNutrition=true              (per-serving nutrients + ingredient names; implies addRecipeInformation)
  &sort=random&number=6
```
- Points per meal search: docs suggest ≈ 2.2, but a real call on 2026-09-27 cost **1.36**; a full plan ≈ 4.1 of the 50/day.
- Fetch a **pool of 6 per meal** in one call; "Show another" rotates through the pool
  (no extra API calls). The dashboard shows one card per meal at a time.
- **No caching** (`cache: "no-store"`) — see §4.3 terms. On HTTP 429 wait 1.1 s and retry once.
- Handle errors: 401 (bad key), **402 (daily points used up → "Recipe limit reached for today, try again after
  midnight UTC")**, 429 (too fast), network failure. Never show a recipe that failed the §5.3 checks.

## 6. Database (Supabase Postgres)

`supabase/migrations/0001_init.sql` (then `0002_saved_recipes_spoonacular.sql`):

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age int not null check (age between 16 and 100),
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  height_cm numeric(5,1) not null check (height_cm between 120 and 230),
  gender text not null check (gender in ('male','female','other')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null check (goal in ('lose','maintain','gain')),
  allergies text[] not null default '{}',        -- e.g. {'peanut-free','dairy-free'}
  other_allergies text[] not null default '{}',  -- free-text words
  updated_at timestamptz not null default now()
);

create table public.saved_recipes (          -- shape after migration 0002 (Spoonacular terms)
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  recipe_id bigint not null check (recipe_id > 0),   -- Spoonacular recipe id
  title text not null,
  image_url text check (image_url like 'https://img.spoonacular.com/%'),
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.profiles enable row level security;
alter table public.saved_recipes enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own saved recipes" on public.saved_recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Calories/macros are **calculated on the fly** from the profile (not stored), so they're always consistent.

## 7. Environment variables

`.env.example` (committed, values empty) / `.env.local` (secret):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SPOONACULAR_API_KEY=
```
The Spoonacular key must **not** have the `NEXT_PUBLIC_` prefix (keeps it server-only).

## 8. Pages & UX

- **/** Landing: what the app does, "Get started" button.
- **/login**: email + password sign up/sign in, or magic link.
- **/profile**: the form. Big touch-friendly inputs, unit toggle (metric/imperial), allergy checkboxes grid,
  "Other allergies" text box. Save → redirect to dashboard.
- **/dashboard**: calorie target card, macro bars (protein/carbs/fat), then Breakfast / Lunch / Dinner sections, each
  with recipe cards (image, name, kcal & macros per serving, "View recipe" link to source, "Show another", ♥ save).
  Allergy badge row: "Excluding: Peanuts, Dairy".
- Loading skeletons, friendly error messages, accessible labels, good colour contrast, dark-mode friendly.
- Mobile-first: single column on phones, 2–3 columns on tablets/desktop.

## 9. Step-by-step build roadmap

Each step ends with a commit + push. Tick boxes as you go.

- [x] **Step 0 — Planning:** write this CLAUDE.md, init Git, push to GitHub.
- [x] **Step 1 — Scaffold:** `npx create-next-app@latest` (TypeScript, Tailwind, App Router, `src/`, ESLint).
      Add `.env.example`, README. Confirm `npm run dev` shows the page at http://localhost:3000.
- [x] **Step 2 — Deploy early:** connect repo to Vercel (Hobby). Confirm the live URL works.
- [x] **Step 3 — Nutrition logic:** `src/lib/nutrition.ts` + Vitest unit tests (§5.1, §5.2).
- [x] **Step 4 — Profile form (no login yet):** form + zod validation; show calories/macros instantly on screen.
- [x] **Step 5 — Supabase:** create free project, run migration, add env vars locally and on Vercel,
      add Supabase clients + `src/proxy.ts` (Next.js 16 renamed middleware to proxy).
- [x] **Step 6 — Auth:** login/sign-up pages, callback route, protect `/profile` and `/dashboard`, sign-out button.
- [x] **Step 7 — Save profile:** load/save profile from Supabase; redirect new users to `/profile`.
- [x] **Step 8 — Recipe API (Spoonacular):** sign up (free, no card), `src/lib/recipes.ts`, caching, error handling.
- [x] **Step 9 — Allergen safety:** `src/lib/allergen-safety.ts`, two-layer filtering, unit tests (§5.3).
- [x] **Step 10 — Dashboard UI:** macro summary, meal sections, recipe cards, "Show another", spoonacular backlink.
- [x] **Step 11 — Saved recipes (optional):** heart button → `saved_recipes` table (id/title/image only, migration
      0002), "Saved recipes" page at `/dashboard/saved` (no API calls).
- [ ] **Step 12 — Polish:** mobile testing (360px, 768px), accessibility, loading/empty/error states, disclaimers.
- [ ] **Step 13 — Launch check:** add Vercel URL to Supabase redirect URLs, test sign-up → profile → plan on a phone,
      confirm no service is on a paid plan.

## 10. Commands (after Step 1)

```
npm install        # install dependencies
npm run dev        # run locally at http://localhost:3000
npm run build      # production build check (run before pushing)
npm run lint       # code style checks
npm test           # unit tests (Vitest)
git add -A && git commit -m "message" && git push   # save + deploy
```

## 11. Conventions

- TypeScript strict mode; no `any`.
- Server-only secrets accessed only in route handlers / server components.
- Pure calculation functions in `src/lib/` with unit tests.
- Small, focused components; Tailwind for styles; no paid UI kits.
- Commit messages: short imperative ("Add profile form").
