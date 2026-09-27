-- Meal Planner database setup. See CLAUDE.md §6.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- One row per user with their body details and allergies.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age int not null check (age between 16 and 100),
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  height_cm numeric(5,1) not null check (height_cm between 120 and 230),
  gender text not null check (gender in ('male','female','other')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null check (goal in ('lose','maintain','gain')),
  allergies text[] not null default '{}',        -- Edamam health labels, e.g. {'peanut-free','dairy-free'}
  other_allergies text[] not null default '{}',  -- free-text words, e.g. {'kiwi'}
  updated_at timestamptz not null default now()
);

-- Recipes a user has hearted.
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

create index saved_recipes_user_id_idx on public.saved_recipes (user_id);

-- Keep profiles.updated_at current on every edit.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Row Level Security: each user can only see and change their own rows.
alter table public.profiles enable row level security;
alter table public.saved_recipes enable row level security;

create policy "Users manage their own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users manage their own saved recipes" on public.saved_recipes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
