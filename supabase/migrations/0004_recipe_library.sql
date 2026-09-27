-- v2 Step 15: our own recipe library (CLAUDE.md §15, §20).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Everyone can READ published recipes and all ingredients.
-- Only admins can WRITE. Admins are listed in public.admins, which users cannot change
-- themselves (no insert/update/delete policies) — the owner adds rows from the dashboard.

-- ---------------------------------------------------------------- admins
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "Users can see whether they are an admin" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

-- True when the signed-in user is an admin. Used by the policies below.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------- ingredients
create table public.ingredients (
  id bigint generated always as identity primary key,
  name text not null unique check (name = lower(name) and char_length(name) between 1 and 80),
  aliases text[] not null default '{}',
  -- USDA FoodData Central id and nutrition per 100 g (filled in Step 16).
  fdc_id integer unique,
  kcal_per_100g numeric(7,2) check (kcal_per_100g >= 0),
  protein_per_100g numeric(6,2) check (protein_per_100g >= 0),
  carbs_per_100g numeric(6,2) check (carbs_per_100g >= 0),
  fat_per_100g numeric(6,2) check (fat_per_100g >= 0),
  fiber_per_100g numeric(6,2) check (fiber_per_100g >= 0),
  -- Allergen ids from src/lib/allergens.ts that this ingredient contains.
  allergen_tags text[] not null default '{}' check (allergen_tags <@ array[
    'peanut-free','tree-nut-free','dairy-free','egg-free','soy-free','wheat-free','gluten-free','fish-free',
    'shellfish-free','crustacean-free','mollusk-free','sesame-free','mustard-free','celery-free','lupine-free',
    'sulfite-free'
  ]::text[]),
  -- Diet flags (src/lib/diet.ts).
  contains_meat boolean not null default false,
  contains_fish boolean not null default false,
  contains_egg boolean not null default false,
  contains_dairy boolean not null default false,
  contains_honey boolean not null default false,
  jain_avoid boolean not null default false, -- onion, garlic, root vegetables, mushrooms
  -- Shopping.
  aisle text not null default 'other' check (aisle in (
    'produce','dairy','meat_fish','grains','pulses','spices','oils','bakery','frozen','beverages','snacks',
    'condiments','other'
  )),
  purchase_unit text not null default 'g' check (purchase_unit in ('g','ml','piece')),
  pack_size numeric(8,2) not null default 500 check (pack_size > 0),
  grams_per_piece numeric(8,2) check (grams_per_piece > 0),
  grams_per_ml numeric(6,3) not null default 1 check (grams_per_ml > 0),
  search_term text not null check (char_length(search_term) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- recipes
create table public.recipes (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  cuisine text not null default 'indian' check (char_length(cuisine) between 1 and 40),
  meal_types text[] not null check (
    cardinality(meal_types) > 0 and meal_types <@ array['breakfast','lunch','dinner']::text[]
  ),
  servings integer not null check (servings between 1 and 20),
  prep_minutes integer not null default 0 check (prep_minutes between 0 and 600),
  cook_minutes integer not null default 0 check (cook_minutes between 0 and 1440),
  steps text[] not null default '{}',
  image_url text check (image_url is null or image_url like 'https://%'),
  status text not null default 'draft' check (status in ('draft','published')),
  source text not null default 'owner' check (source in ('owner','ai')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  -- Computed by the app from recipe_ingredients (Step 16), per serving.
  kcal_per_serving numeric(7,1),
  protein_per_serving numeric(6,1),
  carbs_per_serving numeric(6,1),
  fat_per_serving numeric(6,1),
  fiber_per_serving numeric(6,1),
  allergen_tags text[] not null default '{}',
  diet_types text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_status_idx on public.recipes (status);
create index recipes_meal_types_idx on public.recipes using gin (meal_types);

-- ---------------------------------------------------------------- recipe_ingredients
create table public.recipe_ingredients (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  ingredient_id bigint not null references public.ingredients(id) on delete restrict,
  position integer not null check (position >= 0),
  grams numeric(8,2) not null check (grams > 0 and grams <= 5000),
  display_amount text not null default '' check (char_length(display_amount) <= 40),
  note text not null default '' check (char_length(note) <= 80),
  unique (recipe_id, position)
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);

-- ---------------------------------------------------------------- updated_at triggers
create trigger ingredients_set_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- row level security
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "Anyone can read ingredients" on public.ingredients
  for select to anon, authenticated using (true);
create policy "Admins manage ingredients" on public.ingredients
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Anyone can read published recipes; admins read all" on public.recipes
  for select to anon, authenticated using (status = 'published' or (select public.is_admin()));
create policy "Admins manage recipes" on public.recipes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Read ingredients of visible recipes" on public.recipe_ingredients
  for select to anon, authenticated using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and (r.status = 'published' or (select public.is_admin()))
    )
  );
create policy "Admins manage recipe ingredients" on public.recipe_ingredients
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------- API access
grant select on public.ingredients, public.recipes, public.recipe_ingredients to anon, authenticated;
grant insert, update, delete on public.ingredients, public.recipes, public.recipe_ingredients to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
