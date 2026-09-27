-- v2 Step 26: AI nutrition coach (CLAUDE.md §18).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- Off until the user reads the privacy notice and turns it on.
alter table public.profiles add column coach_enabled boolean not null default false;

create table public.coach_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'model')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index coach_messages_user_time_idx on public.coach_messages (user_id, created_at);
create index coach_messages_time_idx on public.coach_messages (created_at);

alter table public.coach_messages enable row level security;

-- Users read, add and delete their own messages (no editing).
create policy "Users read their own coach messages" on public.coach_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own coach messages" on public.coach_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their own coach messages" on public.coach_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.coach_messages to authenticated;

-- How many questions ALL users asked in the last 24 hours (a number only, no content),
-- so the app can stay under Gemini's free daily limit.
create function public.coach_questions_last_24h()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.coach_messages
  where role = 'user' and created_at > now() - interval '24 hours';
$$;
revoke execute on function public.coach_questions_last_24h() from public, anon;
grant execute on function public.coach_questions_last_24h() to authenticated;
