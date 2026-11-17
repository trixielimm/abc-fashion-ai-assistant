-- Optional first-party offer metrics; no conversation content is stored.
begin;
alter table public.stylist_recommendation_events
  add column placement text not null default 'primary'
  check (placement in ('primary', 'complementary'));
alter table public.stylist_recommendation_events
  drop constraint stylist_recommendation_events_event_type_check;
alter table public.stylist_recommendation_events
  add constraint stylist_recommendation_events_event_type_check
  check (event_type in ('impression', 'select', 'own', 'reject', 'add_to_cart', 'offer_dismiss', 'offers_pause'));
commit;
