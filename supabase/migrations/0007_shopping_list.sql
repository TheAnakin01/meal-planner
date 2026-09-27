-- v2 Step 21: shopping list ticks, extra items and pantry (CLAUDE.md §17, §20).
-- The list itself is calculated live from the week's plan; we only store what the user changes.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- Ticked plan items (ingredient_id set) and the user's own extra items (label set).
create table public.shopping_list_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start date not null,
  ingredient_id bigint references public.ingredients(id) on delete cascade,
  label text check (label is null or char_length(label) between 1 and 80),
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  -- Exactly one of: a plan ingredient, or a custom label.
  check ((ingredient_id is null) <> (label is null)),
  unique (user_id, week_start, ingredient_id)
);
create index shopping_list_items_user_week_idx on public.shopping_list_items (user_id, week_start);

-- Things the user always has at home (salt, spices…): left off every shopping list.
create table public.pantry_items (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ingredient_id bigint not null references public.ingredients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

alter table public.shopping_list_items enable row level security;
alter table public.pantry_items enable row level security;

create policy "Users manage their own shopping list" on public.shopping_list_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own pantry" on public.pantry_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.shopping_list_items, public.pantry_items to authenticated;
