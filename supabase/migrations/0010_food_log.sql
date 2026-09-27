-- v2 Step 28: food diary — what the user actually ate (CLAUDE.md §13 add-on 9, §20).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table public.food_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  eaten_on date not null, -- the user's local date
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  source text not null check (source in ('plan', 'barcode', 'manual')),
  recipe_id bigint references public.recipes(id) on delete set null,
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  label text not null check (char_length(label) between 1 and 120),
  amount text not null default '' check (char_length(amount) <= 40), -- e.g. "1.5 servings", "70 g"
  calories numeric(7,1) not null check (calories between 0 and 10000),
  protein_g numeric(6,1) not null default 0 check (protein_g between 0 and 1000),
  carbs_g numeric(6,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g numeric(6,1) not null default 0 check (fat_g between 0 and 1000),
  created_at timestamptz not null default now()
);
create index food_log_user_day_idx on public.food_log (user_id, eaten_on);

alter table public.food_log enable row level security;

create policy "Users manage their own food log" on public.food_log
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, delete on public.food_log to authenticated;
