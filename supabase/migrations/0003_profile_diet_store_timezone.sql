-- v2 Step 14: diet type, preferred grocery store and timezone on the profile (CLAUDE.md §20).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- Diet type is left empty for existing users on purpose: the app asks them to choose,
-- rather than silently assuming they eat everything.
alter table public.profiles
  add column diet_type text
    check (diet_type in ('veg', 'eggetarian', 'vegan', 'jain', 'nonveg'));

alter table public.profiles
  add column preferred_store text not null default 'bigbasket'
    check (preferred_store in ('bigbasket', 'blinkit', 'zepto', 'instamart', 'amazon', 'jiomart'));

-- IANA timezone name, e.g. 'Asia/Kolkata'. Validated by the app.
alter table public.profiles
  add column timezone text not null default 'Asia/Kolkata'
    check (char_length(timezone) between 1 and 64);
