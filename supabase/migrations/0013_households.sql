-- v2 Step 32: household sharing (CLAUDE.md §13 add-on 14).
-- Each person keeps their OWN plan (own allergies and portions); a household shares ONE combined, live
-- shopping list. Members see each other only by the display name they choose — never emails.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table public.households (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id bigint not null references public.households(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(), -- one household per person
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.household_invites (
  code text primary key check (code ~ '^[A-Z2-9]{8}$'),
  household_id bigint not null references public.households(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days'
);

-- Shared ticks (ingredient_id) and shared extra items (label) for a household's week.
create table public.household_list_items (
  id bigint generated always as identity primary key,
  household_id bigint not null references public.households(id) on delete cascade,
  week_start date not null,
  ingredient_id bigint references public.ingredients(id) on delete cascade,
  label text check (label is null or char_length(label) between 1 and 80),
  checked boolean not null default false,
  added_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((ingredient_id is null) <> (label is null)),
  unique (household_id, week_start, ingredient_id)
);
create index household_list_items_week_idx on public.household_list_items (household_id, week_start);

-- The caller's household id (null if none). Used by the policies below.
create function public.my_household_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = (select auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.household_list_items enable row level security;

create policy "Members see their household" on public.households
  for select to authenticated using (id = (select public.my_household_id()));
create policy "Members rename their household" on public.households
  for update to authenticated using (id = (select public.my_household_id())) with check (id = (select public.my_household_id()));

create policy "Members see each other" on public.household_members
  for select to authenticated using (household_id = (select public.my_household_id()));
create policy "Members update their own display name" on public.household_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members can leave" on public.household_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Members see and make invites" on public.household_invites
  for select to authenticated using (household_id = (select public.my_household_id()));
create policy "Members create invites" on public.household_invites
  for insert to authenticated with check (household_id = (select public.my_household_id()));
create policy "Members delete invites" on public.household_invites
  for delete to authenticated using (household_id = (select public.my_household_id()));

create policy "Members share the household list" on public.household_list_items
  for all to authenticated
  using (household_id = (select public.my_household_id()))
  with check (household_id = (select public.my_household_id()));

grant select, update on public.households to authenticated;
grant select, update (display_name), delete on public.household_members to authenticated;
grant select, insert, delete on public.household_invites to authenticated;
grant select, insert, update, delete on public.household_list_items to authenticated;

-- Create a household with yourself as owner (fails if you're already in one).
create function public.create_household(p_name text, p_display_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if (select auth.uid()) is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid())) then
    raise exception 'Already in a household' using errcode = '23505';
  end if;
  insert into public.households (name, created_by) values (trim(p_name), (select auth.uid())) returning id into v_id;
  insert into public.household_members (household_id, user_id, display_name, role)
    values (v_id, (select auth.uid()), trim(p_display_name), 'owner');
  return v_id;
end;
$$;

-- Join with an invite code (fails if the code is wrong/expired or you're already in a household).
create function public.join_household(p_code text, p_display_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if (select auth.uid()) is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid())) then
    raise exception 'Already in a household' using errcode = '23505';
  end if;
  select household_id into v_id from public.household_invites
    where code = upper(trim(p_code)) and expires_at > now();
  if v_id is null then raise exception 'Invalid or expired code' using errcode = 'P0002'; end if;
  if (select count(*) from public.household_members where household_id = v_id) >= 8 then
    raise exception 'Household is full' using errcode = '53400';
  end if;
  insert into public.household_members (household_id, user_id, display_name, role)
    values (v_id, (select auth.uid()), trim(p_display_name), 'member');
  return v_id;
end;
$$;

-- Everyone's planned meals for a week in the caller's household — only recipe ids and portions,
-- so the combined shopping list can be built. No names, allergies or other personal data.
create function public.household_week_slots(p_week date)
returns table (recipe_id bigint, portion numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select i.recipe_id, i.portion
  from public.household_members hm
  join public.meal_plans mp on mp.user_id = hm.user_id and mp.week_start = p_week
  join public.meal_plan_items i on i.plan_id = mp.id
  where hm.household_id = (select public.my_household_id());
$$;

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
revoke execute on function public.household_week_slots(date) from public, anon;
revoke execute on function public.my_household_id() from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.household_week_slots(date) to authenticated;
grant execute on function public.my_household_id() to authenticated;

-- Live updates for the shared list (Supabase Realtime respects the policies above).
alter publication supabase_realtime add table public.household_list_items;
