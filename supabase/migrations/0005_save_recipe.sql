-- v2 Step 17: save a recipe and its ingredient lines in ONE transaction, so a half-saved recipe
-- can never be seen. Called by the admin recipe editor (src/app/admin/recipes/actions.ts).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- A published recipe must always have nutrition.
alter table public.recipes
  add constraint recipes_published_needs_nutrition
  check (status <> 'published' or kcal_per_serving is not null);

-- p_recipe: recipe fields (+ "id" when editing) incl. nutrition/allergens/diets computed by the app server.
-- p_lines:  [{ "ingredient_id": 1, "grams": 200, "display_amount": "1 cup", "note": "" }, ...] in order.
-- Runs with the caller's permissions (security invoker), so RLS still applies: only admins can write.
create function public.save_recipe(p_recipe jsonb, p_lines jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint := nullif(p_recipe->>'id', '')::bigint;
  v_has_nutrition boolean := (p_recipe->>'kcal_per_serving') is not null;
begin
  if not public.is_admin() then
    raise exception 'Only admins can save recipes' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A recipe needs at least one ingredient' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.recipes (
      title, description, cuisine, meal_types, servings, prep_minutes, cook_minutes, steps, image_url, source,
      kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving,
      allergen_tags, diet_types
    ) values (
      p_recipe->>'title',
      coalesce(p_recipe->>'description', ''),
      coalesce(p_recipe->>'cuisine', 'indian'),
      array(select jsonb_array_elements_text(p_recipe->'meal_types')),
      (p_recipe->>'servings')::integer,
      coalesce((p_recipe->>'prep_minutes')::integer, 0),
      coalesce((p_recipe->>'cook_minutes')::integer, 0),
      array(select jsonb_array_elements_text(coalesce(p_recipe->'steps', '[]'::jsonb))),
      nullif(p_recipe->>'image_url', ''),
      coalesce(p_recipe->>'source', 'owner'),
      (p_recipe->>'kcal_per_serving')::numeric,
      (p_recipe->>'protein_per_serving')::numeric,
      (p_recipe->>'carbs_per_serving')::numeric,
      (p_recipe->>'fat_per_serving')::numeric,
      (p_recipe->>'fiber_per_serving')::numeric,
      array(select jsonb_array_elements_text(coalesce(p_recipe->'allergen_tags', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(p_recipe->'diet_types', '[]'::jsonb)))
    )
    returning id into v_id;
  else
    update public.recipes set
      title = p_recipe->>'title',
      description = coalesce(p_recipe->>'description', ''),
      cuisine = coalesce(p_recipe->>'cuisine', 'indian'),
      meal_types = array(select jsonb_array_elements_text(p_recipe->'meal_types')),
      servings = (p_recipe->>'servings')::integer,
      prep_minutes = coalesce((p_recipe->>'prep_minutes')::integer, 0),
      cook_minutes = coalesce((p_recipe->>'cook_minutes')::integer, 0),
      steps = array(select jsonb_array_elements_text(coalesce(p_recipe->'steps', '[]'::jsonb))),
      image_url = nullif(p_recipe->>'image_url', ''),
      kcal_per_serving = (p_recipe->>'kcal_per_serving')::numeric,
      protein_per_serving = (p_recipe->>'protein_per_serving')::numeric,
      carbs_per_serving = (p_recipe->>'carbs_per_serving')::numeric,
      fat_per_serving = (p_recipe->>'fat_per_serving')::numeric,
      fiber_per_serving = (p_recipe->>'fiber_per_serving')::numeric,
      allergen_tags = array(select jsonb_array_elements_text(coalesce(p_recipe->'allergen_tags', '[]'::jsonb))),
      diet_types = array(select jsonb_array_elements_text(coalesce(p_recipe->'diet_types', '[]'::jsonb))),
      -- An edit that leaves the recipe without nutrition takes it off the menu.
      status = case when v_has_nutrition then status else 'draft' end,
      published_at = case when v_has_nutrition then published_at else null end
    where id = v_id;
    if not found then
      raise exception 'Recipe % not found', v_id using errcode = 'P0002';
    end if;
  end if;

  delete from public.recipe_ingredients where recipe_id = v_id;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, grams, display_amount, note)
  select v_id,
         (line->>'ingredient_id')::bigint,
         (ord - 1)::integer,
         (line->>'grams')::numeric,
         coalesce(line->>'display_amount', ''),
         coalesce(line->>'note', '')
  from jsonb_array_elements(p_lines) with ordinality as t(line, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_recipe(jsonb, jsonb) from public, anon;
grant execute on function public.save_recipe(jsonb, jsonb) to authenticated;
