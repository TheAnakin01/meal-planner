-- v2 Step 29: weight log for progress charts (CLAUDE.md §13 add-on 10, §20).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table public.weight_log (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  logged_on date not null, -- the user's local date; one weight per day (re-logging replaces it)
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  created_at timestamptz not null default now(),
  primary key (user_id, logged_on)
);

alter table public.weight_log enable row level security;

create policy "Users manage their own weight log" on public.weight_log
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.weight_log to authenticated;
