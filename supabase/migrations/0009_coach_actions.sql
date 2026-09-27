-- v2 Step 27: coach can PROPOSE actions (swap a meal, add to shopping list); the user confirms.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

alter table public.coach_messages
  add column action jsonb,
  add column action_status text check (action_status in ('proposed', 'done', 'cancelled')),
  add column action_result text check (action_result is null or char_length(action_result) <= 300),
  add constraint coach_messages_action_has_status check ((action is null) = (action_status is null));

-- Users may only change the status/result of their own messages (never the text or the action itself).
create policy "Users update their own coach action status" on public.coach_messages
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant update (action_status, action_result) on public.coach_messages to authenticated;
