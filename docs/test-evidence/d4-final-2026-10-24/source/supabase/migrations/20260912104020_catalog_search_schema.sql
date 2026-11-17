-- Reshape the empty catalog into an explicit three-level taxonomy and add
-- semantic search support for OpenAI text-embedding-3-small.

create extension if not exists vector
with schema extensions;

-- Remove policies that depend on products.is_active before renaming it.
drop policy "public can read active products" on public.products;
drop policy "public can read sizes of active products" on public.product_sizes;
drop policy "public can read tags of active products" on public.product_tags;
drop policy "public can read cross-sell of active products" on public.cross_sell_rules;

-- Replace the open-ended category tree with an explicit hierarchy.
alter table public.products
  drop constraint products_category_id_fkey;

alter table public.categories
  drop constraint categories_parent_category_id_fkey;

drop index public.categories_parent_name_uidx;
drop index public.categories_parent_category_id_idx;
drop index public.products_category_id_idx;
drop index public.products_active_gender_idx;

alter table public.categories
  drop column parent_category_id;

alter table public.categories
  add constraint categories_category_name_unique unique (category_name);

create table public.subcategories (
  subcategory_id bigint generated always as identity primary key,
  category_id bigint not null
    references public.categories (category_id) on delete restrict,
  subcategory_name text not null,
  constraint subcategories_category_name_unique
    unique (category_id, subcategory_name)
);

create index subcategories_category_id_idx
  on public.subcategories (category_id);

create table public.product_types (
  product_type_id bigint generated always as identity primary key,
  subcategory_id bigint not null
    references public.subcategories (subcategory_id) on delete restrict,
  product_type_name text not null,
  constraint product_types_subcategory_name_unique
    unique (subcategory_id, product_type_name)
);

create index product_types_subcategory_id_idx
  on public.product_types (subcategory_id);

alter table public.products
  drop column category_id,
  drop column rating,
  drop column popularity_score;

alter table public.products
  rename column is_active to is_available;

alter table public.products
  add column product_type_id bigint not null
    references public.product_types (product_type_id) on delete restrict,
  add column embedding_vector extensions.vector(1536);

create index products_product_type_id_idx
  on public.products (product_type_id);

create index products_available_gender_idx
  on public.products (gender)
  where is_available;

create index products_embedding_vector_hnsw_idx
  on public.products
  using hnsw (embedding_vector extensions.vector_cosine_ops)
  where embedding_vector is not null;

-- Description embeddings must be regenerated after their source text changes.
create or replace function public.set_product_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();

  if new.description is distinct from old.description then
    new.embedding_vector := null;
  end if;

  return new;
end;
$$;

drop trigger products_set_updated_at on public.products;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_product_updated_at();

drop function public.set_updated_at();

comment on table public.categories is
  'Top-level product categories, such as Clothing or Shoes.';
comment on table public.subcategories is
  'Second-level product groupings, such as Dresses.';
comment on table public.product_types is
  'Leaf product types, such as Midi Dress.';
comment on column public.products.embedding_vector is
  '1536-dimensional description embedding from OpenAI text-embedding-3-small.';
comment on column public.products.is_available is
  'Explicit catalogue availability independent of current stock quantity.';

alter table public.subcategories enable row level security;
alter table public.product_types enable row level security;

create policy "public can read subcategories"
  on public.subcategories
  for select
  to anon, authenticated
  using (true);

create policy "public can read product types"
  on public.product_types
  for select
  to anon, authenticated
  using (true);

create policy "public can read available products"
  on public.products
  for select
  to anon, authenticated
  using (is_available);

create policy "public can read sizes of available products"
  on public.product_sizes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.product_id = product_sizes.product_id
        and p.is_available
    )
  );

create policy "public can read tags of available products"
  on public.product_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.product_id = product_tags.product_id
        and p.is_available
    )
  );

create policy "public can read cross-sell of available products"
  on public.cross_sell_rules
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.product_id = cross_sell_rules.product_id
        and p.is_available
    )
  );

grant select on table
  public.subcategories,
  public.product_types
to anon, authenticated;

revoke insert, update, delete, truncate on table
  public.subcategories,
  public.product_types
from anon, authenticated;

-- Flatten the normalized source tables into the shape consumed by the catalog
-- and AI interfaces. The view obeys all underlying RLS policies.
create view public.product_catalog
with (security_invoker = true)
as
select
  p.product_id,
  p.product_name,
  p.brand_line,
  p.gender,
  c.category_name as category,
  sc.subcategory_name as subcategory,
  pt.product_type_name as product_type,
  p.colour,
  p.style,
  p.occasion,
  p.season,
  p.material,
  p.fit,
  coalesce(inventory.sizes_available, array[]::text[]) as sizes_available,
  p.price_aud,
  coalesce(inventory.stock_qty, 0) as stock_qty,
  p.description,
  coalesce(product_tags.tags, array[]::text[]) as tags,
  cross_sell.category_name as cross_sell_category,
  p.image_key,
  p.is_available
from public.products p
join public.product_types pt
  on pt.product_type_id = p.product_type_id
join public.subcategories sc
  on sc.subcategory_id = pt.subcategory_id
join public.categories c
  on c.category_id = sc.category_id
left join lateral (
  select
    array_agg(s.size_label order by s.size_order)
      filter (where ps.stock_qty > 0) as sizes_available,
    coalesce(sum(ps.stock_qty), 0)::integer as stock_qty
  from public.product_sizes ps
  join public.sizes s
    on s.size_id = ps.size_id
  where ps.product_id = p.product_id
) inventory on true
left join lateral (
  select array_agg(t.tag_name order by t.tag_name) as tags
  from public.product_tags ptg
  join public.tags t
    on t.tag_id = ptg.tag_id
  where ptg.product_id = p.product_id
) product_tags on true
left join lateral (
  select target.category_name
  from public.cross_sell_rules csr
  join public.categories target
    on target.category_id = csr.target_category_id
  where csr.product_id = p.product_id
  order by csr.priority desc, csr.cross_sell_id
  limit 1
) cross_sell on true
where p.is_available;

comment on view public.product_catalog is
  'Public read model combining normalized catalogue, inventory, tags, and cross-sell data.';

grant select on public.product_catalog to anon, authenticated;

create or replace function public.match_products(
  query_embedding extensions.vector(1536),
  match_threshold double precision,
  match_count integer
)
returns table (
  product_id text,
  product_name text,
  brand_line text,
  gender text,
  category text,
  subcategory text,
  product_type text,
  colour text,
  style text,
  occasion text,
  season text,
  material text,
  fit text,
  sizes_available text[],
  price_aud numeric,
  stock_qty integer,
  description text,
  tags text[],
  cross_sell_category text,
  image_key text,
  is_available boolean,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      p.product_id,
      1 - (
        p.embedding_vector
        operator(extensions.<=>)
        query_embedding
      ) as similarity
    from public.products p
    where p.is_available
      and p.embedding_vector is not null
      and 1 - (
        p.embedding_vector
        operator(extensions.<=>)
        query_embedding
      ) >= match_threshold
    order by
      p.embedding_vector
      operator(extensions.<=>)
      query_embedding
    limit least(greatest(match_count, 1), 50)
  )
  select
    catalog.product_id,
    catalog.product_name,
    catalog.brand_line,
    catalog.gender,
    catalog.category,
    catalog.subcategory,
    catalog.product_type,
    catalog.colour,
    catalog.style,
    catalog.occasion,
    catalog.season,
    catalog.material,
    catalog.fit,
    catalog.sizes_available,
    catalog.price_aud,
    catalog.stock_qty,
    catalog.description,
    catalog.tags,
    catalog.cross_sell_category,
    catalog.image_key,
    catalog.is_available,
    ranked.similarity
  from ranked
  join public.product_catalog catalog
    on catalog.product_id = ranked.product_id
  order by ranked.similarity desc;
$$;

comment on function public.match_products(
  extensions.vector(1536),
  double precision,
  integer
) is
  'Returns up to 50 available products ordered by cosine similarity.';

revoke all on function public.match_products(
  extensions.vector(1536),
  double precision,
  integer
) from public;

grant execute on function public.match_products(
  extensions.vector(1536),
  double precision,
  integer
) to anon, authenticated;
