-- Recommendation positions are local to each product group.
begin;

alter table public.stylist_recommendation_events
  drop constraint if exists stylist_recommendation_events_position_check;

alter table public.stylist_recommendation_events
  add constraint stylist_recommendation_events_position_check
  check (position between 1 and 5);

commit;
