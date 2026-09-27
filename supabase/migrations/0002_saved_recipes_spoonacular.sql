-- Make saved_recipes follow Spoonacular's terms (CLAUDE.md §4.3):
-- only the recipe id, title and image URL may be stored permanently.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- The table has no rows yet; clear it anyway so the id conversion can't fail.
delete from public.saved_recipes;

alter table public.saved_recipes drop column source_url;
alter table public.saved_recipes drop column calories_per_serving;

alter table public.saved_recipes rename column label to title;
alter table public.saved_recipes rename column recipe_uri to recipe_id;
alter table public.saved_recipes alter column recipe_id type bigint using recipe_id::bigint;
alter table public.saved_recipes add constraint saved_recipes_recipe_id_positive check (recipe_id > 0);

-- Images must come from Spoonacular's image server.
alter table public.saved_recipes add constraint saved_recipes_image_url_spoonacular
  check (image_url is null or image_url like 'https://img.spoonacular.com/%');
