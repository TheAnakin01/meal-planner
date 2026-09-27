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

### Out of scope for v1 (see Part 2 for v2)
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
- [x] **Step 12 — Polish:** mobile testing (360px, 768px), accessibility, loading/empty/error states, disclaimers.
      Done 2026-09-27: axe-core (WCAG 2 A/AA + best practice) reports 0 issues on all pages in light and dark mode;
      colours meet 4.5:1 (use emerald-700 for white-text buttons, zinc-600/zinc-400 for secondary text);
      error.tsx, not-found.tsx, loading.tsx added; recipe cards go side-by-side from 640px.
- [ ] **Step 13 — Launch check:** add Vercel URL to Supabase redirect URLs, test sign-up → profile → plan on a phone,
      confirm no service is on a paid plan.
      Automated checks passed 2026-09-27: live pages/redirects/404/footer backlink OK; `.env.local` never committed and
      no keys in git history; Spoonacular key absent from browser bundles; strangers read `[]` and writes are refused
      by RLS; `npm audit --omit=dev` 0 vulnerabilities. **Remaining (owner):** phone walkthrough + confirm free plans.

## 10. Known limits & maintenance (free plans)

- **Spoonacular:** 50 points/day ≈ 12 plan-page views/day across all users (no caching, §4.3). When used up, meals
  show "Today's free recipe limit has been reached" until midnight UTC. "Show another" and the Saved page cost 0.
- **Supabase:** free projects pause after ~1 week without visits → the app shows "Something went wrong". Fix: Supabase
  dashboard → project → **Restore** (free). Built-in auth email is limited to a few emails/hour.
- **Vercel Hobby:** free for personal, non-commercial use. Never enable paid add-ons.
- **Allergen safety** (§5.3) is strict by design and may leave a meal with no suggestions; that is intended.
- Rotating a key: update `.env.local` and Vercel → Settings → Environment Variables, then **Redeploy**.

## 11. Commands (after Step 1)

```
npm install        # install dependencies
npm run dev        # run locally at http://localhost:3000
npm run build      # production build check (run before pushing)
npm run lint       # code style checks
npm test           # unit tests (Vitest)
git add -A && git commit -m "message" && git push   # save + deploy
```

## 12. Conventions

- TypeScript strict mode; no `any`.
- Server-only secrets accessed only in route handlers / server components.
- Pure calculation functions in `src/lib/` with unit tests.
- Small, focused components; Tailwind for styles; no paid UI kits.
- Commit messages: short imperative ("Add profile form").

---

# PART 2 — v2 "Advanced" (planned 2026-09-27)

Everything in Part 1 still applies, **especially §0: zero cost, strict allergen safety, secrets never in Git,
plain-language guidance for the owner.** v2 turns the daily recommender into a weekly planning product for
**Indian users** (with international recipes too).

## 13. v2 goals

Owner-requested:
1. **Weekly meal plan (v2 core):** a 7-day breakfast/lunch/dinner plan saved per week, portion-scaled to the user's
   targets, with "swap this meal" and "regenerate day".
2. **Shopping list:** built automatically from the week's plan, quantities combined and rounded to what shops sell,
   grouped by aisle, tick-off as you shop.
3. **Buy ingredients online:** from any recipe or the shopping list, one tap opens the item's search page on Indian
   grocery apps (§17).
4. **Offline-first installable app (PWA):** installs to the home screen, opens and works offline for the user's own
   data (plan, recipes in our library, shopping list, diary), syncs changes when back online.
5. **AI nutrition coach:** chat that knows the user's targets, allergies, diet type and week plan; can explain,
   suggest swaps and draft recipes — never overrides the allergen engine, never gives medical advice.

Add-ons (proposed by Claude to make it stand out):
6. **Indian diet types:** vegetarian, eggetarian, vegan, Jain (no onion/garlic/root vegetables), non-vegetarian —
   a first-class filter alongside allergies.
7. **Pantry ("I already have"):** items in the pantry are subtracted from the shopping list.
8. **Share list on WhatsApp:** one tap sends the shopping list as text (`https://wa.me/?text=...`).
9. **Food diary + barcode scan:** log what you actually ate; scan packaged food barcodes via **Open Food Facts**
   (free, open data) using the phone camera.
10. **Progress insights:** weight trend, weekly calorie/macro adherence charts, streaks.
11. **Smart allergen-safe swaps:** "can't find paneer?" → safe substitutes that still fit macros.
12. **Batch-cook / leftovers mode:** cook dinner once, reuse as next day's lunch (fewer items to buy).
13. **Meal reminders:** free web push notifications (breakfast/lunch/dinner times).
14. **Household sharing (later):** family members share one plan and a live shopping list (Supabase Realtime).

Explicitly out of scope: payments, native App Store / Play Store apps (fees break §0), store checkout integrations or
affiliate programs, storing any Spoonacular data beyond id/title/image.

## 14. Key decisions (2026-09-27)

| Decision | Choice | Why |
|---|---|---|
| Recipe source | **Our own recipe library** in Supabase | Spoonacular free terms forbid storing ingredients/nutrition (blocks shopping lists, offline, buy links) and cap us at ~2 weekly plans/day. Own data has no limits and can include Indian dishes. |
| Nutrition data | **USDA FoodData Central** API (public domain, free key, ~1,000 requests/hour) | We may store it forever. Ingredient nutrition is fetched once and saved to our `ingredients` table. |
| Packaged food | **Open Food Facts** (free, open data, ODbL — attribution required) | Barcode lookups for the food diary. |
| Spoonacular | Kept as optional **"Discover"** tab | Same v1 rules: id/title/image only, no caching, ~4 points per view. |
| Mobile app | **PWA** (web app manifest + service worker via **Serwist**) | Free; same codebase. Next.js 16 has built-in `app/manifest.ts`, web push, and an experimental `useOffline` hook (see `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` and `offline-support.md`). |
| AI provider | **Google Gemini API free tier** (current Flash model; confirm exact free model name at build time on ai.google.dev/gemini-api/docs/pricing) | Free, no card. **Free-tier content may be used by Google to improve its products** → strict data minimisation (§18). Claude API was not chosen only because it is paid per use. |
| Grocery purchase | **Deep links to store search pages** | No APIs, no fees, no accounts. We never place orders or handle payments. |

## 15. Recipe library & nutrition engine

- **Recipes are created by the owner (admin)** in an admin editor, or **drafted by the AI** (§18) and then reviewed
  and published by the owner. Only `published` recipes are shown to users.
- Each recipe has ingredients with **quantity in grams or ml** (plus a friendly display amount, e.g. "1 cup").
- Each ingredient maps to a canonical row in `ingredients`, which stores **per-100 g nutrition from USDA FDC**
  (`fdc_id`), **allergen tags**, **diet flags** (is_meat, is_fish, is_egg, is_dairy, is_root_veg, is_onion_garlic),
  shopping aisle, purchase unit (e.g. 500 g pack, 1 L, piece) and a grocery search term.
- Recipe nutrition per serving = Σ(ingredient grams × per-100 g values) ÷ servings. Computed by pure, unit-tested
  functions; stored on publish and recomputed when an ingredient's data changes.
- **Allergen engine v2:** ingredient allergen tags (primary, set by owner/AI and reviewed) **plus** the v1 keyword
  check over ingredient names and title (backup). Both must pass. Same strictness as §5.3.
- Seed target for launch: **~80 recipes** (≈ 30 breakfast, 50 lunch/dinner), majority Indian, all diet types covered.

## 16. Weekly planner

- Plan week = Monday–Sunday in the user's timezone. One `meal_plans` row per user per week.
- Algorithm (pure, deterministic given a seed, unit-tested, runs on the server — **no API cost**):
  1. Candidate recipes = published ∩ allergen-safe ∩ diet-type-compatible ∩ meal type.
  2. For each day and meal, pick a recipe and a **portion multiplier (0.5×–2.0×, 0.25 steps)** so calories land
     within ±10% of the meal target (§5.2 split); prefer recipes whose macro ratio is closest to the user's.
  3. Variety rules: same recipe at most 2× per week, not on consecutive days (unless leftovers mode), mix cuisines.
  4. Leftovers mode: dinner portion × 2 with the second portion placed as next day's lunch.
- User actions: swap one meal (pick next best candidate), lock a meal, regenerate a day, regenerate the week.
- Daily totals vs targets are shown per day; the v1 dashboard becomes "Today" from the current week's plan.

## 17. Shopping list & buying online

- Generated from the week's plan: Σ(ingredient grams × portion multiplier × servings eaten), combined across meals,
  minus pantry items, rounded **up** to purchase units (e.g. 730 g rice → "1 kg"), grouped by aisle.
- Stored in `shopping_list_items` (it is our own data) with `checked` state; user can add custom items.
- Share: WhatsApp link with the list as plain text; copy to clipboard.
- **Buy links** (open in a new tab; the item's search term is URL-encoded):

| Store | Search URL pattern |
|---|---|
| BigBasket | `https://www.bigbasket.com/ps/?q={term}` |
| Blinkit | `https://blinkit.com/s/?q={term}` |
| Zepto | `https://www.zeptonow.com/search?query={term}` |
| Swiggy Instamart | `https://www.swiggy.com/instamart/search?query={term}` |
| Amazon.in | `https://www.amazon.in/s?k={term}` |
| JioMart | `https://www.jiomart.com/search/{term}` |

  The user picks a preferred store in settings (default BigBasket). Checked 2026-09-27: BigBasket and JioMart answer
  normally; the others block automated checks but open fine in a browser. Re-check the patterns before launch, and
  keep them in one config file (`src/lib/stores.ts`) so a changed URL is a one-line fix. No affiliate tags.

## 18. AI nutrition coach (Gemini free tier)

- Server-only: `GEMINI_API_KEY` (no `NEXT_PUBLIC_`), called from a route handler / server action.
- **Opt-in:** the coach is off until the user reads a short notice and turns it on ("Messages are processed by Google
  Gemini's free service, which may use them to improve Google products. Don't share names, contact details or
  medical records.").
- **Data minimisation:** send only age range, goal, calorie/macro targets, diet type, allergy list, this week's
  meal titles and (if diary enabled) daily totals. **Never** send name, email, user id or exact date of birth.
- **Grounding:** the coach answers from our data; recipe suggestions must come from our library (the model returns
  recipe ids, which the server looks up) or be saved as *drafts* for owner review — never shown to users as safe
  until they pass the allergen engine and are published.
- **Actions** (function calling, server-validated): swap a meal, add item to shopping list, explain a nutrient.
  Every action re-checks allergens and ownership on the server.
- **Safety rules in the system prompt + server checks:** no medical diagnosis or treatment advice; for eating
  disorders, pregnancy, diabetes, kidney disease, etc. → recommend a professional; never suggest < §5.1 floor calories.
- **Limits:** per-user daily message cap (e.g. 20) and a global cap well under the free tier's rate limits; friendly
  message when reached. Chat history kept for 30 days max, deletable by the user.
- Admin-only **recipe drafting tool**: owner describes a dish → Gemini returns structured JSON (title, servings,
  ingredients in grams, steps) → our code maps ingredients, fetches USDA nutrition, runs allergen/diet checks → owner
  edits and publishes.

## 19. Offline-first PWA

- `src/app/manifest.ts` (name, icons, theme colour, `display: "standalone"`), app icons in `public/icons/`.
- Service worker via **Serwist**: precache the app shell; runtime-cache our own pages and recipe images from our
  library; **never** cache Spoonacular responses or images (terms).
- Local data in **IndexedDB**: current + next week's plan, those recipes, shopping list, pantry, recent diary.
- Offline edits (tick item, log food, swap to a cached candidate) go into an **outbox** and sync when online;
  conflict rule: last write wins per item, server validates everything.
- UI shows an "Offline — changes will sync" banner (Next.js `useOffline` hook or `navigator.onLine`).
- Install prompt on Android/Chrome; "Add to Home Screen" instructions on iPhone.

## 20. v2 data model (new tables; all with Row Level Security "users see only their own rows")

- `profiles` + columns: `diet_type` (veg | eggetarian | vegan | jain | nonveg), `timezone`, `preferred_store`,
  `leftovers_mode`, `coach_enabled`.
- `ingredients` (public read): name, aliases, fdc_id, nutrients per 100 g, allergen_tags[], diet flags, aisle,
  purchase_unit, grams_per_unit, search_term.
- `recipes` (public read when published): title, description, cuisine, meal_types[], servings, steps[], image_url,
  status (draft | published), created_by, nutrition per serving (computed), diet_types[] (computed).
- `recipe_ingredients`: recipe_id, ingredient_id, grams, display_amount.
- `meal_plans`: user_id, week_start. `meal_plan_items`: plan_id, day (0–6), meal, recipe_id, portion, locked,
  is_leftover. (Spoonacular discoveries can be *saved* but not planned — no ingredient data.)
- `shopping_list_items`: user_id, week_start, ingredient_id (nullable for custom), label, quantity, unit, checked.
- `pantry_items`: user_id, ingredient_id, note.
- `food_log`: user_id, eaten_at, recipe_id | off_barcode | custom label, portion, calories, protein, carbs, fat.
- `weight_log`: user_id, date, weight_kg.
- `coach_messages`: user_id, role, content, created_at (auto-deleted after 30 days).
- `push_subscriptions`: user_id, endpoint, keys (for reminders).
- `admins` (user_id): who may edit the library. **Not** a profile column, because users can update their own profile
  row. Users can only *read* their own admins row; the owner adds rows in the Supabase dashboard. RLS on
  `ingredients`/`recipes`/`recipe_ingredients` allows writes only when `public.is_admin()` is true (migration 0004).

## 21. New environment variables

```
USDA_FDC_API_KEY=        # free, api.data.gov signup (server-only)
GEMINI_API_KEY=          # free tier, Google AI Studio (server-only)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # web push (public by design)
VAPID_PRIVATE_KEY=              # web push (server-only)
```

## 22. v2 roadmap

Same rules as §9: one step at a time, tests for all logic, commit + push after each, owner clicks guided.

**Phase A — Foundations**
- [x] **Step 14 — Diet type & settings:** diet type, preferred store, timezone in profile (migration 0003).
      Diet rules live in `src/lib/diet.ts` (reuse allergen rules + meat/Jain word lists + Spoonacular diet flags) and
      already filter the v1 Spoonacular dashboard. Store links in `src/lib/stores.ts`. Existing users with no diet
      type are sent to /profile to choose one (never assumed).
- [x] **Step 15 — Library schema:** `ingredients`, `recipes`, `recipe_ingredients` + admin RLS (migration 0004);
      owner marks themselves admin.
- [x] **Step 16 — Nutrition engine:** USDA FDC client (server-only, free key), per-100 g import into `ingredients`,
      recipe nutrition calculator + allergen engine v2 + diet-type rules, with tests.
      Findings 2026-09-27: use **POST** `/foods/search` (GET with `dataType=Survey (FNDDS)` intermittently returned an
      HTML 400); include **Survey (FNDDS)** — it has paneer, besan, ghee; energy may only exist as Atwater 958/957;
      USDA values for Indian foods can be off (FNDDS paneer lists 22 g carbs/100 g), so the importer lets the owner
      edit numbers. Rate limit seen: 3,600 requests/hour. Code: `usda.ts`, `usda-server.ts`, `recipe-analysis.ts`,
      `ingredient-input.ts`, admin page `/admin/ingredients`.
- [x] **Step 17 — Admin recipe editor:** create/edit/publish recipes, ingredient search, live nutrition preview.
      Saves go through `public.save_recipe(p_recipe, p_lines)` (migration 0005) in one transaction; the server
      recomputes nutrition/allergens/diets from DB ingredients (browser values never trusted); published recipes must
      have nutrition (DB constraint). Editing an ingredient recalculates every recipe using it. Importer warns when
      kcal is >7% off the macro estimate (fibre counted at 2 kcal/g).
- [x] **Step 18 — AI recipe drafting (admin only):** Gemini free key, structured JSON drafts → review → publish;
      seed ~80 recipes. (Tool built; seeding ~80 recipes is ongoing owner work.)
      Findings 2026-09-27: models tried in order `GEMINI_MODELS` in `src/lib/gemini-server.ts` (3.8 Flash often 503
      "high demand" on free tier → fall back to 3.5 Flash; 2.5 Flash retired); ~20–25 s per draft, so the draft page sets
      `maxDuration = 120`. Structured output via `generationConfig.responseJsonSchema`. Drafts are matched to library
      ingredients by name/alias with plural stemming; unmatched ones must be added (or dropped) before saving. Saved as
      `status=draft, source=ai`; nutrition/allergens/diets always come from our engine, never the AI.

**Phase B — Weekly plan, shopping list, buy online (owner's first priority)**
- [x] **Step 19 — Weekly planner engine:** portion scaling, variety, leftovers; tests.
      `src/lib/planner.ts` (pure, seeded): `eligibleRecipes` re-runs allergen/diet word checks on top of stored tags;
      `generateWeek` search order puts calorie fit (±10%) before variety (2×/wk, no consecutive days → 3×/wk → poor
      fit → heavy repeats; same-day repeats only as last resort) and explains relaxations in `notes`; gaps are left
      empty rather than filled unsafely; `swapMeal`, `dayTotals`, `weekStart` (Monday in user timezone).
      Importer also warns when a dry staple looks like a cooked value (< 250 kcal/100 g).
- [x] **Step 20 — Week view UI:** 7-day plan, daily totals, swap / lock / regenerate, recipe detail page.
      Migration 0006 (`meal_plans`, `meal_plan_items`, `profiles.leftovers_mode`). `/week` creates the plan on first
      visit; meals whose recipe no longer suits the user are dropped on load ("Fill" refills). `/recipes/[id]` shows the
      user's portion. Actions in `src/app/week/actions.ts`.
- [x] **Step 21 — Shopping list:** generation, unit rounding, aisles, tick-off, custom items, pantry.
      List is computed live from the plan (`src/lib/shopping.ts`); migration 0007 stores only ticks, extra items
      (`shopping_list_items`) and pantry (`pantry_items`). Water is never listed. Page `/shopping`.
- [x] **Step 22 — Buy online & share:** store links (§17), preferred store, WhatsApp share, copy list.
      "Buy on <store>" per shopping item and per recipe ingredient; store picker on /shopping saves
      `profiles.preferred_store`; WhatsApp/copy share unticked items (`buildShareText`).
- [x] **Step 23 — Today view:** v1 dashboard reads today's meals from the week plan; Spoonacular moves to "Discover".
      `/dashboard` = Today (targets + today's slots + Swap/Fill); `/discover` = Spoonacular ideas (~4 points/visit) with
      link to Saved; header links: Today, Week, Sign out.

**Phase C — Offline-first app**
- [x] **Step 24 — Installable PWA:** manifest, icons, install prompt, iPhone instructions.
      `src/app/manifest.ts` (start_url /dashboard, standalone, shortcuts); icons from `scripts/generate-icons.mjs`
      (sharp) into `public/icons` + `src/app/icon.png`; `appleWebApp` + theme colour in layout; `InstallPrompt` on Today.
- [x] **Step 25 — Offline data & sync:** Serwist service worker, IndexedDB store, outbox sync, offline banner.
      Changed approach (2026-09-27): hand-written `public/sw.js` instead of Serwist (less to maintain, exact control):
      app files cache-first; ONLY own pages (/dashboard, /week, /shopping, /recipes/:id, /profile) network-first; never
      /discover (Spoonacular terms), /admin, other origins, POSTs or RSC requests; sign-out clears saved pages
      (`SignOutButton`). Offline ticks use a localStorage outbox (`src/lib/outbox.ts`) instead of IndexedDB (tiny data).
      SW registers in production only (`OfflineSupport`, also the offline banner). Logic tested in `tests/sw.test.ts`
      (Node sandbox) — the Claude desktop preview browser can't register service workers.
      Fix (sw v2): in-app (client-side) navigation never loads whole pages, so `OfflineSupport` posts
      {type:"cache-pages"} on each route change with the current page, /dashboard, /week, /shopping and linked
      /recipes/:id pages; the SW fetches savable ones (max once/minute each).

**Phase D — AI coach**
- [x] **Step 26 — Coach chat:** opt-in notice, minimised context, safety rules, caps, history deletion.
      Migration 0008 (`profiles.coach_enabled`, `coach_messages`, `coach_questions_last_24h()`). `/coach`; context and
      rules in `src/lib/coach.ts` (age range only; no name/email/weight/height); limits 20 questions/user/24 h and
      200/all users/24 h; every reply gets a server-added ⚠️ note if it mentions the user's allergens; history kept 30 days,
      deletable; turning the coach off deletes history. Tested live 2026-09-27 (fell back to 3.5 Flash Lite, 15 s).
- [x] **Step 27 — Coach actions:** swap meal / add to list via validated function calls.
      Gemini function calling (`COACH_TOOLS` in `src/lib/coach-actions.ts`); calls are parsed/validated (max 3) and stored
      as PROPOSED action cards (migration 0009: `action`, `action_status`, `action_result`; users may update only the
      status columns). Nothing changes until the user taps Confirm; `resolveCoachActionAction` then runs the shared
      `swapMealForCurrentUser` (planner picks a safe recipe) / `addShoppingItemForCurrentUser` (`src/lib/plan-mutations.ts`).
      Tested live: 3.8 Flash, 2 s, both calls correct.
      Fix 2026-09-27: asking the coach showed the error screen, then the answer after "Try again". Coach actions no longer
      call revalidatePath (which re-rendered /coach after the slow AI call); they return the saved messages / new status and
      the chat updates itself. Gemini calls share a ~75 s deadline across model fallbacks.

**Phase E — Add-ons**
- [x] **Step 28 — Food diary + barcode:** manual log, recipe log, Open Food Facts barcode scan (with attribution).
      Migration 0010 (`food_log`). `/diary` (day navigation, totals vs targets, one-tap log of today's planned meals,
      manual entry, barcode via the browser's BarcodeDetector camera API on Android Chrome or typed digits). OFF lookups
      server-side with custom User-Agent, cached 1 day; OFF allergen/trace tags + our word check → red/amber warnings;
      nutrition for planned/barcode entries computed on the server.
- [ ] **Step 29 — Progress insights:** weight trend, adherence charts, streaks.
- [ ] **Step 30 — Smart swaps:** allergen-safe substitutions that keep macros close.
- [ ] **Step 31 — Reminders:** web push for meal times (VAPID keys, opt-in).
- [ ] **Step 32 — Household sharing:** invite family, shared plan + live shopping list (Supabase Realtime).
- [ ] **Step 33 — v2 launch check:** full phone walkthrough online + offline, a11y audit, security/RLS review,
      confirm every service still on a free plan.

## 23. v2 free-plan limits to design around

| Service | Free limit (check before each phase) | Design response |
|---|---|---|
| Supabase Free | 500 MB database, 1 GB file storage, pauses after ~1 week idle | Store recipe images as small WebP; no user photo uploads in v2 |
| Vercel Hobby | Non-commercial use, function time limits | Keep AI calls short; no paid add-ons |
| USDA FDC | ~1,000 requests/hour per key | Look up each ingredient once; store results |
| Gemini free | Per-minute and per-day request caps per model | Per-user and global daily caps; graceful "coach is resting" message |
| Open Food Facts | Fair-use rate limits; attribution | Only on barcode scan; show "Data from Open Food Facts" |
| Spoonacular Free | 50 points/day; strict storage terms | "Discover" tab only; id/title/image saved |
