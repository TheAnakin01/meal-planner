-- v2 Step 31: meal reminders by web push (CLAUDE.md §13 add-on 13).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- The scheduler (pg_cron) and its secret are set up separately from a file that is NOT in Git.

-- Reminder settings (times are in the user's own timezone; opt-in).
alter table public.profiles
  add column reminders_enabled boolean not null default false,
  add column breakfast_reminder time not null default '08:00' check (breakfast_reminder <= '23:30'),
  add column lunch_reminder time not null default '13:00' check (lunch_reminder <= '23:30'),
  add column dinner_reminder time not null default '20:00' check (dinner_reminder <= '23:30');

-- One row per phone/browser that allowed notifications.
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "Users manage their own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Which reminders were already sent (so each goes out at most once a day). Only the function below uses it.
create table public.reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
  sent_on date not null,
  primary key (user_id, meal, sent_on)
);
alter table public.reminder_log enable row level security; -- no policies: not readable through the API

-- Secrets live in a schema the API can't see.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.app_secrets (name text primary key, value text not null);

-- Called every 15 minutes by the scheduler (via the app). Returns reminders that are due now, marks them
-- as sent, and includes today's planned recipe name. Returns nothing unless the secret is right.
create function public.claim_due_reminders(p_secret text)
returns table (r_user_id uuid, r_meal text, r_endpoint text, r_p256dh text, r_auth text, r_title text)
language sql
volatile
security definer
set search_path = ''
as $$
  with authorised as (
    select 1 from private.app_secrets where name = 'cron' and value = p_secret and p_secret is not null
  ),
  due as (
    select p.id as user_id, m.meal, (now() at time zone p.timezone)::date as local_date
    from public.profiles p
    cross join lateral (values ('breakfast', p.breakfast_reminder), ('lunch', p.lunch_reminder), ('dinner', p.dinner_reminder)) as m(meal, at_time)
    where exists (select 1 from authorised)
      and p.reminders_enabled
      and (now() at time zone p.timezone)::time >= m.at_time
      and (now() at time zone p.timezone)::time < m.at_time + interval '15 minutes'
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  ),
  claimed as (
    insert into public.reminder_log (user_id, meal, sent_on)
    select user_id, meal, local_date from due
    on conflict do nothing
    returning user_id, meal, sent_on
  )
  select c.user_id, c.meal, s.endpoint, s.p256dh, s.auth,
    (
      select r.title
      from public.meal_plans mp
      join public.meal_plan_items i on i.plan_id = mp.id
      join public.recipes r on r.id = i.recipe_id
      where mp.user_id = c.user_id
        and mp.week_start = date_trunc('week', c.sent_on)::date
        and i.day = extract(isodow from c.sent_on)::int - 1
        and i.meal = c.meal
      limit 1
    )
  from claimed c
  join public.push_subscriptions s on s.user_id = c.user_id;
$$;

-- Removes a phone that the push service says no longer exists (uninstalled, permission revoked).
create function public.remove_push_subscription(p_secret text, p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint
    and exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret and p_secret is not null);
$$;

grant execute on function public.claim_due_reminders(text) to anon, authenticated;
grant execute on function public.remove_push_subscription(text, text) to anon, authenticated;
