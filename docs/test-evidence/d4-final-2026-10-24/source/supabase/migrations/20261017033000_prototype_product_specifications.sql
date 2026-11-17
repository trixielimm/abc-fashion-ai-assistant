begin;

-- Synthetic catalogue definitions for this prototype. These never enter the
-- supplier-verified facts table and are never represented as supplier evidence.
create table public.prototype_product_specifications (
  product_id text primary key references public.products(product_id) on delete cascade,
  source_kind text not null default 'synthetic' check (source_kind = 'synthetic'),
  dataset_version text not null check (dataset_version = 'prototype-specs-v1'),
  generator_model text not null check (length(trim(generator_model)) between 1 and 250),
  generated_at timestamptz not null,
  identity_snapshot jsonb not null check (jsonb_typeof(identity_snapshot) = 'object' and identity_snapshot->>'product_id' = product_id),
  specification jsonb not null check (jsonb_typeof(specification) = 'object' and specification->>'product_id' = product_id)
);
alter table public.prototype_product_specifications enable row level security;
create policy "public read prototype specifications for available products"
  on public.prototype_product_specifications for select to anon, authenticated
  using (exists (select 1 from public.product_catalog p where p.product_id = prototype_product_specifications.product_id and p.is_available = true));
revoke all on public.prototype_product_specifications from anon, authenticated;
grant select on public.prototype_product_specifications to anon, authenticated;
grant all on public.prototype_product_specifications to service_role;
comment on table public.prototype_product_specifications is 'OpenAI-generated synthetic specifications for prototype products. Format/coherence validation is not supplier verification.';

commit;
