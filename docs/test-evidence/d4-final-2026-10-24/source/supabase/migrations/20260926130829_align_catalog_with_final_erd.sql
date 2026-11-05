begin;

-- ============================================================
-- ALIGN PRODUCT CATALOGUE WITH FINAL ERD
--
-- CURRENT:
--
-- categories
--   -> subcategories
--      -> product_types
--         -> products
--
-- FINAL:
--
-- categories
--   -> child categories/subcategories
--      -> products
--
-- products.product_type stores values such as "Midi Dress".
--
-- We KEEP:
-- - pgvector / embedding_vector
-- - semantic search
-- - sizes / stock
-- - tags
-- - cross-sell rules
-- - RLS policies
-- ============================================================


-- ============================================================
-- 1. REMOVE OBJECTS THAT DEPEND ON THE OLD TAXONOMY
-- ============================================================

-- The existing semantic-search function uses product_catalog,
-- so remove the function before rebuilding the view.
drop function if exists public.match_products(
    extensions.vector(1536),
    double precision,
    integer
);

-- The current view joins through:
-- products -> product_types -> subcategories -> categories.
-- We will recreate it for the final ERD.
drop view if exists public.product_catalog;


-- ============================================================
-- 2. REMOVE PRODUCT POLICIES THAT WE WILL RECREATE
-- ============================================================

drop policy if exists "public can read available products"
    on public.products;

drop policy if exists "public can read sizes of available products"
    on public.product_sizes;

drop policy if exists "public can read tags of available products"
    on public.product_tags;

drop policy if exists "public can read cross-sell of available products"
    on public.cross_sell_rules;


-- ============================================================
-- 3. CONVERT CATEGORIES INTO THE FINAL HIERARCHICAL MODEL
-- ============================================================

-- Migration 2 made category_name globally unique.
-- The final ERD instead allows a category to have a parent.
alter table public.categories
    drop constraint if exists categories_category_name_unique;


-- Add parent_category_id from the final ERD.
alter table public.categories
    add column if not exists parent_category_id bigint;


-- Make CATEGORIES self-referencing.
alter table public.categories
    add constraint categories_parent_category_id_fkey
    foreign key (parent_category_id)
    references public.categories(category_id)
    on delete restrict;


-- ============================================================
-- 4. MOVE EXISTING SUBCATEGORIES INTO CATEGORIES
-- ============================================================

-- Example old structure:
--
-- CATEGORIES
-- 1 | Clothing
--
-- SUBCATEGORIES
-- 5 | Clothing | Dresses
--
-- New structure:
--
-- CATEGORIES
-- 1 | Clothing | NULL
-- x | Dresses  | 1
--
-- This preserves any subcategories already created.

insert into public.categories (
    category_name,
    parent_category_id
)
select
    sc.subcategory_name,
    sc.category_id
from public.subcategories sc
where not exists (
    select 1
    from public.categories existing
    where existing.category_name = sc.subcategory_name
      and existing.parent_category_id = sc.category_id
);


-- Prevent duplicate category names underneath the same parent.
create unique index if not exists categories_parent_name_uidx
    on public.categories (
        coalesce(parent_category_id, 0),
        category_name
    );


-- Makes parent lookups faster.
create index if not exists categories_parent_category_id_idx
    on public.categories(parent_category_id);


-- ============================================================
-- 5. CHANGE PRODUCTS TO MATCH THE FINAL ERD
-- ============================================================

-- Products currently reference PRODUCT_TYPES.
-- We are replacing that with:
--
-- category_id
-- product_type
--
alter table public.products
    drop constraint if exists products_product_type_id_fkey;


drop index if exists public.products_product_type_id_idx;

drop index if exists public.products_available_gender_idx;


-- Products currently has 0 rows, so this is safe.
alter table public.products
    drop column if exists product_type_id;


-- Add fields from the final ERD.
alter table public.products

    add column category_id bigint not null
        references public.categories(category_id)
        on delete restrict,

    add column product_type varchar not null,

    add column rating numeric(3, 2),

    add column popularity_score smallint,

    add column is_active boolean not null default true;


-- ============================================================
-- 6. ADD DATA-QUALITY CONSTRAINTS
-- ============================================================

-- Rating can be NULL.
-- If supplied, it must be between 0 and 5.
alter table public.products
    add constraint products_rating_range
    check (
        rating is null
        or (
            rating >= 0
            and rating <= 5
        )
    );


-- Popularity can be NULL.
-- If supplied, it cannot be negative.
alter table public.products
    add constraint products_popularity_score_nonnegative
    check (
        popularity_score is null
        or popularity_score >= 0
    );


-- ============================================================
-- 7. REMOVE THE OLD TAXONOMY TABLES
-- ============================================================

-- product_type now lives directly on PRODUCTS.
drop table if exists public.product_types;


-- Subcategories are now child records inside CATEGORIES.
drop table if exists public.subcategories;


-- ============================================================
-- 8. CREATE USEFUL PRODUCT INDEXES
-- ============================================================

create index if not exists products_category_id_idx
    on public.products(category_id);


create index if not exists products_active_available_gender_idx
    on public.products(gender)
    where is_active and is_available;


create index if not exists products_price_aud_idx
    on public.products(price_aud);


create index if not exists products_colour_idx
    on public.products(colour);


create index if not exists products_style_idx
    on public.products(style);


create index if not exists products_occasion_idx
    on public.products(occasion);


create index if not exists products_product_type_idx
    on public.products(product_type);


-- IMPORTANT:
--
-- We deliberately KEEP the existing:
--
-- products.embedding_vector
--
-- and:
--
-- products_embedding_vector_hnsw_idx
--
-- because semantic search is still part of the project.


-- ============================================================
-- 9. DATABASE DOCUMENTATION
-- ============================================================

comment on table public.categories is
    'Hierarchical product taxonomy. parent_category_id links a child category/subcategory to its parent.';


comment on table public.products is
    'Sellable fashion catalogue products. Public catalogue access requires products to be active and available.';


comment on column public.products.category_id is
    'References the most specific applicable category/subcategory.';


comment on column public.products.product_type is
    'Specific product type such as Midi Dress, Blouse, Sandal or Tote Bag.';


comment on column public.products.is_active is
    'Whether the product remains part of the catalogue.';


comment on column public.products.is_available is
    'Whether the product is currently available for recommendation.';


comment on column public.products.embedding_vector is
    '1536-dimensional description embedding from OpenAI text-embedding-3-small.';


-- ============================================================
-- 10. RECREATE PRODUCT RLS POLICIES
-- ============================================================

-- Public users should only see products that:
--
-- 1. still belong to the catalogue
-- 2. are currently available

create policy "public can read active available products"
    on public.products
    for select
    to anon, authenticated
    using (
        is_active
        and is_available
    );


create policy "public can read sizes of active available products"
    on public.product_sizes
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.products p
            where p.product_id = product_sizes.product_id
              and p.is_active
              and p.is_available
        )
    );


create policy "public can read tags of active available products"
    on public.product_tags
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.products p
            where p.product_id = product_tags.product_id
              and p.is_active
              and p.is_available
        )
    );


create policy "public can read cross-sell of active available products"
    on public.cross_sell_rules
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.products p
            where p.product_id = cross_sell_rules.product_id
              and p.is_active
              and p.is_available
        )
    );


-- ============================================================
-- 11. REBUILD THE FLATTENED PRODUCT CATALOGUE VIEW
-- ============================================================

-- The physical database remains relational/normalised.
--
-- This view gives the backend/AI a convenient object such as:
--
-- category: Clothing
-- subcategory: Dresses
-- product_type: Midi Dress
--
-- rather than forcing the AI layer to understand SQL joins.

create view public.product_catalog
with (security_invoker = true)
as
select

    p.product_id,
    p.product_name,
    p.brand_line,
    p.gender,

    -- Example:
    --
    -- parent = Clothing
    -- child  = Dresses
    --
    -- category becomes Clothing.
    coalesce(
        parent.category_name,
        child.category_name
    ) as category,

    -- If there is a parent category,
    -- the child is treated as the subcategory.
    case
        when parent.category_id is not null
            then child.category_name
        else null
    end as subcategory,

    p.product_type,

    p.colour,
    p.style,
    p.occasion,
    p.season,
    p.material,
    p.fit,

    -- Create an array containing sizes that currently have stock.
    coalesce(
        inventory.sizes_available,
        array[]::text[]
    ) as sizes_available,

    p.price_aud,

    -- Total stock across all sizes.
    coalesce(
        inventory.stock_qty,
        0
    ) as stock_qty,

    p.description,

    -- Create a simple array of product tags.
    coalesce(
        product_tag_data.tags,
        array[]::text[]
    ) as tags,

    -- Return the highest-priority cross-sell category.
    cross_sell.category_name as cross_sell_category,

    p.image_key,

    p.is_available

from public.products p


-- PRODUCTS.category_id points to the most specific category.
join public.categories child
    on child.category_id = p.category_id


-- Find the parent if the selected category is a child.
left join public.categories parent
    on parent.category_id = child.parent_category_id


-- ============================================================
-- INVENTORY
-- ============================================================

left join lateral (

    select

        array_agg(
            s.size_label
            order by s.size_order
        )
        filter (
            where ps.stock_qty > 0
        ) as sizes_available,

        coalesce(
            sum(ps.stock_qty),
            0
        )::integer as stock_qty

    from public.product_sizes ps

    join public.sizes s
        on s.size_id = ps.size_id

    where ps.product_id = p.product_id

) inventory on true


-- ============================================================
-- TAGS
-- ============================================================

left join lateral (

    select

        array_agg(
            t.tag_name
            order by t.tag_name
        ) as tags

    from public.product_tags ptg

    join public.tags t
        on t.tag_id = ptg.tag_id

    where ptg.product_id = p.product_id

) product_tag_data on true


-- ============================================================
-- CROSS-SELL
-- ============================================================

left join lateral (

    select
        target.category_name

    from public.cross_sell_rules csr

    join public.categories target
        on target.category_id = csr.target_category_id

    where csr.product_id = p.product_id

    order by
        csr.priority desc,
        csr.cross_sell_id

    limit 1

) cross_sell on true


where
    p.is_active
    and p.is_available;


comment on view public.product_catalog is
    'Flattened public catalogue combining product taxonomy, inventory, tags and cross-sell information.';


grant select
    on public.product_catalog
    to anon, authenticated;


-- ============================================================
-- 12. REBUILD SEMANTIC VECTOR SEARCH
-- ============================================================

-- This preserves the semantic-search capability introduced
-- by the previous migration, but connects it to the new
-- product_catalog structure.

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

        where
            p.is_active
            and p.is_available
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

        limit least(
            greatest(match_count, 1),
            50
        )

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
    'Returns up to 50 active and available products ordered by cosine similarity.';


revoke all
    on function public.match_products(
        extensions.vector(1536),
        double precision,
        integer
    )
    from public;


grant execute
    on function public.match_products(
        extensions.vector(1536),
        double precision,
        integer
    )
    to anon, authenticated;


commit;