-- Fashion catalog schema. Public read via the Data API; writes stay service-role only.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create table public.categories (
  category_id bigint generated always as identity primary key,
  category_name text not null,
  parent_category_id bigint references public.categories (category_id) on delete restrict
);

create unique index categories_parent_name_uidx
  on public.categories (coalesce(parent_category_id, 0), category_name);

create index categories_parent_category_id_idx
  on public.categories (parent_category_id);

create table public.sizes (
  size_id bigint generated always as identity primary key,
  size_label text not null unique,
  size_order smallint not null,
  constraint sizes_size_order_unique unique (size_order)
);

create table public.tags (
  tag_id bigint generated always as identity primary key,
  tag_name text not null unique
);

create table public.products (
  product_id text primary key,
  brand_line text,
  product_name text not null,
  gender text,
  category_id bigint not null references public.categories (category_id) on delete restrict,
  colour text,
  style text,
  occasion text,
  season text,
  material text,
  fit text,
  price_aud numeric(10, 2) not null,
  rating numeric(3, 2),
  popularity_score smallint not null default 0,
  description text,
  image_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_aud_nonnegative check (price_aud >= 0),
  constraint products_rating_range check (rating is null or (rating >= 0 and rating <= 5)),
  constraint products_popularity_score_nonnegative check (popularity_score >= 0)
);

create index products_category_id_idx
  on public.products (category_id);

create index products_active_gender_idx
  on public.products (gender)
  where is_active;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

create table public.product_sizes (
  product_id text not null references public.products (product_id) on delete cascade,
  size_id bigint not null references public.sizes (size_id) on delete restrict,
  stock_qty integer not null default 0,
  primary key (product_id, size_id),
  constraint product_sizes_stock_qty_nonnegative check (stock_qty >= 0)
);

create index product_sizes_size_id_idx
  on public.product_sizes (size_id);

create table public.product_tags (
  product_id text not null references public.products (product_id) on delete cascade,
  tag_id bigint not null references public.tags (tag_id) on delete cascade,
  primary key (product_id, tag_id)
);

create index product_tags_tag_id_idx
  on public.product_tags (tag_id);

create table public.cross_sell_rules (
  cross_sell_id bigint generated always as identity primary key,
  product_id text not null references public.products (product_id) on delete cascade,
  target_category_id bigint not null references public.categories (category_id) on delete restrict,
  priority smallint not null default 0,
  constraint cross_sell_rules_priority_nonnegative check (priority >= 0),
  constraint cross_sell_rules_product_category_unique unique (product_id, target_category_id)
);

create index cross_sell_rules_target_category_id_idx
  on public.cross_sell_rules (target_category_id);

comment on table public.categories is 'Product taxonomy; parent_category_id builds nested departments.';
comment on table public.sizes is 'Canonical size labels shared across products.';
comment on table public.tags is 'Freeform descriptors used by the assistant for filtering.';
comment on table public.products is 'Sellable fashion catalog items. Public API only returns is_active rows.';
comment on table public.product_sizes is 'Per-size stock for a product.';
comment on table public.product_tags is 'Many-to-many product descriptors.';
comment on table public.cross_sell_rules is 'Recommended add-on categories for a given product.';

alter table public.categories enable row level security;
alter table public.sizes enable row level security;
alter table public.tags enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;
alter table public.product_tags enable row level security;
alter table public.cross_sell_rules enable row level security;

create policy "public can read categories"
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy "public can read sizes"
  on public.sizes
  for select
  to anon, authenticated
  using (true);

create policy "public can read tags"
  on public.tags
  for select
  to anon, authenticated
  using (true);

create policy "public can read active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active);

create policy "public can read sizes of active products"
  on public.product_sizes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.product_id = product_sizes.product_id
        and p.is_active
    )
  );

create policy "public can read tags of active products"
  on public.product_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.product_id = product_tags.product_id
        and p.is_active
    )
  );

create policy "public can read cross-sell of active products"
  on public.cross_sell_rules
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.product_id = cross_sell_rules.product_id
        and p.is_active
    )
  );

grant select on table
  public.categories,
  public.sizes,
  public.tags,
  public.products,
  public.product_sizes,
  public.product_tags,
  public.cross_sell_rules
to anon, authenticated;

revoke insert, update, delete, truncate on table
  public.categories,
  public.sizes,
  public.tags,
  public.products,
  public.product_sizes,
  public.product_tags,
  public.cross_sell_rules
from anon, authenticated;
