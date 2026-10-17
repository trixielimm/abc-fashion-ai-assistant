begin;

-- Merchant/supplier evidence. No feature claims are invented or auto-backfilled.
create table public.stylist_product_features (
  product_id text not null references public.products(product_id) on delete cascade,
  feature_key text not null check (feature_key in ('lining','adjustable_strap','pockets','zip_closure','machine_washable','capacity_litres','use_cases')),
  value jsonb not null,
  source_reference text not null check (length(trim(source_reference)) between 1 and 1000),
  source_version text not null check (length(trim(source_version)) between 1 and 100),
  review_status text not null default 'draft' check (review_status in ('draft','verified','rejected')),
  reviewed_by text,
  verified_at timestamptz,
  primary key (product_id, feature_key),
  constraint verified_features_need_review check (review_status <> 'verified' or (verified_at is not null and reviewed_by is not null and length(trim(reviewed_by)) > 0)),
  constraint feature_value_type check (
    case
      when feature_key in ('lining','adjustable_strap','pockets','zip_closure','machine_washable') then jsonb_typeof(value) = 'boolean'
      when feature_key = 'capacity_litres' then case when jsonb_typeof(value) = 'number' then value::text::numeric > 0 else false end
      when feature_key = 'use_cases' then case when jsonb_typeof(value) = 'array' then jsonb_array_length(value) between 1 and 12 else false end
      else false
    end
  )
);
alter table public.stylist_product_features enable row level security;
create policy "public read reviewed features of available products" on public.stylist_product_features
  for select to anon, authenticated using (
    review_status = 'verified' and exists (
      select 1 from public.product_catalog p where p.product_id = stylist_product_features.product_id and p.is_available = true
    )
  );
revoke all on public.stylist_product_features from anon, authenticated;
grant select (product_id,feature_key,value,source_reference,source_version,review_status,verified_at)
  on public.stylist_product_features to anon, authenticated;
grant all on public.stylist_product_features to service_role;

-- Minimal first-party interaction events. These are untrusted browser signals,
-- never purchase confirmations. Anonymous clients cannot read or insert rows.
create table public.stylist_recommendation_events (
  event_id uuid primary key,
  session_id uuid not null,
  recommendation_id uuid not null,
  event_type text not null check (event_type in ('impression','select','own','reject','add_to_cart')),
  product_id text not null references public.products(product_id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  policy_version text not null check (policy_version = 'stylist-commerce-v1'),
  received_at timestamptz not null default now(),
  signal_source text not null default 'untrusted_browser' check (signal_source = 'untrusted_browser')
);
create index stylist_recommendation_events_received_at_idx on public.stylist_recommendation_events(received_at);
create index stylist_recommendation_events_recommendation_idx on public.stylist_recommendation_events(recommendation_id);
alter table public.stylist_recommendation_events enable row level security;
revoke all on public.stylist_recommendation_events from anon, authenticated;
grant all on public.stylist_recommendation_events to service_role;

comment on table public.stylist_product_features is 'Reviewed product facts for evidence-backed comparisons. Only approved public evidence references belong here.';
comment on table public.stylist_recommendation_events is 'Minimal untrusted interaction telemetry; no messages, identity, prices, purchase or return claims.';

commit;
