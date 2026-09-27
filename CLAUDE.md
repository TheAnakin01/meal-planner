@AGENTS.md

# Meal Planner — Project Spec & Build Guide

> This file is the single source of truth for this project. Claude Code reads it
> automatically at the start of every session. Keep it up to date as the app evolves.

## 0. Ground rules (read first)

1. **Zero cost, always.** The owner has ordered that no money is spent and nothing is purchased.
   - Use only free tiers: GitHub Free, Vercel **Hobby**, Supabase **Free**, Edamam free/developer plan.
   - **Never** enter a credit card, never click "Upgrade", "Pro", "Start trial" or anything that needs payment details.
   - If a service asks for a card or has no free tier, **stop and tell the owner**, then switch to a free alternative
     (see §4.4 fallback), rather than paying.
   - Don't add paid npm packages, paid fonts or paid image services.
2. **The owner has zero coding knowledge.** Explain every step in plain language. When something must be clicked in a
   website (GitHub, Supabase, Vercel, Edamam), give numbered click-by-click instructions.
3. **Secrets never go in Git.** API keys live only in `.env.local` (local) and in Vercel's Environment Variables
   (production). `.env*.local` is git-ignored.
4. **Allergen safety is strict.** A recipe that might contain a user's allergen must never be shown (see §5.3).
5. Mobile-first design: every screen must work at 360px wide with no sideways scrolling.

## 1. What the app does

A web app that:

1. Lets a user sign up / log in (email + password or magic link) via Supabase Auth.
2. Collects a profile: **age, weight, height, gender, activity level, goal (lose / maintain / gain), allergies**.
3. Calculates **daily calorie target** and **macros** (protein, carbs, fat in grams).
4. Recommends **breakfast, lunch and dinner** recipes from the **Edamam Recipe Search API** that fit the calorie
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
| Recipes          | Edamam Recipe Search API v2                     | Free dev plan (verify) |
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
│   │   ├── dashboard/page.tsx # calories, macros, 3 meal recommendations
│   │   └── api/
│   │       └── recipes/route.ts     # server-side proxy to Edamam (keeps keys secret)
│   ├── components/
│   │   ├── ProfileForm.tsx
│   │   ├── MacroSummary.tsx
│   │   ├── MealCard.tsx
│   │   ├── MealSection.tsx
│   │   └── ui/                # Button, Input, Select, Card, Spinner...
│   ├── lib/
│   │   ├── nutrition.ts       # BMR / TDEE / calorie & macro maths (§5.1, §5.2)
│   │   ├── allergens.ts       # allergy list, Edamam label mapping, ingredient keyword check (§5.3)
│   │   ├── edamam.ts          # Edamam request builder + response parsing
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

### 4.3 Edamam (Recipe Search API)
1. developer.edamam.com → Sign up → choose the **free / Developer** Recipe Search plan.
   **If every plan requires a card or payment, STOP** and use the fallback in §4.4.
2. Dashboard → Applications → create app → copy **Application ID** and **Application Key**.
3. Free plans have rate limits (roughly ~10 requests/minute). The app must cache results (§5.4) and handle HTTP 429.
4. Edamam's free-plan terms require showing **"Powered by Edamam"** attribution — add it to the footer.

### 4.4 Fallback if Edamam has no free option
Keep all Edamam code inside `src/lib/edamam.ts` behind a `searchRecipes()` function so the provider can be swapped.
Free alternatives: Spoonacular free tier (daily point limit, no card) or TheMealDB (free, no nutrition data — would need
our own calorie estimates). Ask the owner before switching.

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
Supported allergies (checkbox list) → Edamam `health` label:

| Allergy     | Edamam `health` param |
|-------------|-----------------------|
| Peanuts     | `peanut-free`         |
| Tree nuts   | `tree-nut-free`       |
| Dairy/milk  | `dairy-free`          |
| Eggs        | `egg-free`            |
| Soy         | `soy-free`            |
| Wheat       | `wheat-free`          |
| Gluten      | `gluten-free`         |
| Fish        | `fish-free`           |
| Shellfish   | `shellfish-free`      |
| Crustaceans | `crustacean-free`     |
| Molluscs    | `mollusk-free`        |
| Sesame      | `sesame-free`         |
| Mustard     | `mustard-free`        |
| Celery      | `celery-free`         |
| Lupin       | `lupine-free`         |
| Sulphites   | `sulfite-free`        |

Plus a free-text "Other allergies" field (comma-separated words, e.g. "kiwi, strawberry").

1. **Layer 1 (API filter):** send every selected label as repeated `health=` params, and free-text items via
   `excluded=` params.
2. **Layer 2 (our own double-check, server-side):** after results come back, reject any recipe where
   - its `healthLabels` is missing any required label, **or**
   - any `ingredientLines` / `ingredients[].food` contains a keyword from that allergen's keyword list in
     `allergens.ts` (e.g. dairy → milk, butter, cheese, cream, yogurt, whey, casein, ghee; wheat → flour, bread, pasta,
     couscous, semolina...; case-insensitive, word match), or any free-text allergy word.
3. If no safe recipes remain for a meal, show "No safe recipes found — try again" rather than an unsafe one.
4. Unit tests in `tests/allergens.test.ts` must prove unsafe recipes are removed.
5. UI disclaimer: "Always check ingredient labels; data comes from third parties."

### 5.4 Edamam request (server-side only, `src/app/api/recipes/route.ts`)
```
GET https://api.edamam.com/api/recipes/v2
  ?type=public
  &app_id=$EDAMAM_APP_ID&app_key=$EDAMAM_APP_KEY
  &mealType=Breakfast|Lunch|Dinner
  &calories=MIN-MAX                (total recipe calories; convert per-serving using yield — filter again locally)
  &health=peanut-free&health=...   (one per allergy)
  &excluded=kiwi&excluded=...
  &random=true
  &field=label&field=image&field=url&field=yield&field=calories&field=totalNutrients
  &field=healthLabels&field=ingredientLines&field=ingredients&field=mealType
Header (if the account requires it): Edamam-Account-User: <supabase user id>
```
- Compute per-serving calories/protein/carbs/fat = total ÷ `yield`; keep those within the meal target range.
- Return 3 options per meal; user can tap "Show another" to swap.
- Cache responses in memory/Next.js fetch cache for ~1 hour per unique query to stay under free rate limits.
- Handle errors: 401 (bad keys), 429 (rate limit → friendly "please wait a minute"), network failure.

## 6. Database (Supabase Postgres)

`supabase/migrations/0001_init.sql`:

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

create table public.saved_recipes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  recipe_uri text not null,
  label text not null,
  image_url text,
  source_url text,
  calories_per_serving int,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_uri)
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
EDAMAM_APP_ID=
EDAMAM_APP_KEY=
```
Edamam keys must **not** have the `NEXT_PUBLIC_` prefix (keeps them server-only).

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
- [ ] **Step 5 — Supabase:** create free project, run migration, add env vars locally and on Vercel,
      add Supabase clients + `src/proxy.ts` (Next.js 16 renamed middleware to proxy).
- [ ] **Step 6 — Auth:** login/sign-up pages, callback route, protect `/profile` and `/dashboard`, sign-out button.
- [ ] **Step 7 — Save profile:** load/save profile from Supabase; redirect new users to `/profile`.
- [ ] **Step 8 — Edamam integration:** sign up (free), `src/lib/edamam.ts`, `/api/recipes` route, caching, error handling.
- [ ] **Step 9 — Allergen safety:** `src/lib/allergens.ts`, two-layer filtering, unit tests (§5.3).
- [ ] **Step 10 — Dashboard UI:** macro summary, meal sections, recipe cards, "Show another", Edamam attribution.
- [ ] **Step 11 — Saved recipes (optional):** heart button → `saved_recipes` table, "My saved recipes" list.
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
