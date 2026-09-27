-- v2 Step 20: saved weekly meal plans (CLAUDE.md §16, §20).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

alter table public.profiles add column leftovers_mode boolean not null default false;

create table public.meal_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start date not null, -- Monday, in the user's timezone
  seed integer not null,    -- planner randomness, so "regenerate" gives a new but repeatable week
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.meal_plan_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.meal_plans(id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  meal text not null check (meal in ('breakfast','lunch','dinner')),
  -- Deleting a recipe removes it from plans (that meal becomes empty and can be refilled).
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  portion numeric(4,2) not null check (portion between 0.25 and 3),
  locked boolean not null default false,
  is_leftover boolean not null default false,
  unique (plan_id, day, meal)
);
create index meal_plan_items_plan_idx on public.meal_plan_items (plan_id);
create index meal_plan_items_recipe_idx on public.meal_plan_items (recipe_id);

create trigger meal_plans_set_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();

alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

create policy "Users manage their own meal plans" on public.meal_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage items of their own meal plans" on public.meal_plan_items
  for all to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid())));

grant select, insert, update, delete on public.meal_plans, public.meal_plan_items to authenticated;
