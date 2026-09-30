-- Trigger-only SECURITY DEFINER functions must not be callable as public RPCs.
revoke all on function public.bought_queue_rank_push()
  from public, anon, authenticated;
revoke all on function public.bought_queue_new_leader_push()
  from public, anon, authenticated;

-- Cover the push-event owner foreign key for cleanup and owner-scoped lookups.
create index if not exists bought_push_events_user
  on public.bought_push_events(user_id);
