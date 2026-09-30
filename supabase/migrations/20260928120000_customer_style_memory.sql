-- Customer-owned style memory. No chat transcript is stored here.
create table public.style_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferred_name text not null default '',
  updated_at timestamptz not null default now(),
  constraint preferred_name_length check (char_length(preferred_name) <= 80)
);

create table public.style_sizes (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('dress', 'shoes')),
  size_system text not null,
  size_label text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type),
  constraint size_system_length check (char_length(size_system) between 1 and 20),
  constraint size_label_length check (char_length(size_label) between 1 and 30)
);

create table public.style_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('like', 'avoid', 'note')),
  facet text not null check (facet in ('colour', 'style', 'brand_line', 'material', 'fit', 'product_type', 'tag', 'note')),
  value text not null,
  item_scope text,
  created_at timestamptz not null default now(),
  constraint memory_value_length check (char_length(value) between 1 and 240),
  constraint memory_scope_length check (item_scope is null or char_length(item_scope) between 1 and 80),
  constraint note_facet_matches_kind check ((kind = 'note') = (facet = 'note'))
);
create index style_memories_user_idx on public.style_memories (user_id, created_at desc);

create table public.saved_products (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create function public.set_style_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger style_profiles_set_updated_at
  before update on public.style_profiles
  for each row execute function public.set_style_updated_at();
create trigger style_sizes_set_updated_at
  before update on public.style_sizes
  for each row execute function public.set_style_updated_at();

alter table public.style_profiles enable row level security;
alter table public.style_sizes enable row level security;
alter table public.style_memories enable row level security;
alter table public.saved_products enable row level security;

revoke all on public.style_profiles, public.style_sizes, public.style_memories, public.saved_products from anon;
grant select, insert, update, delete on public.style_profiles, public.style_sizes to authenticated;
grant select, insert, delete on public.style_memories, public.saved_products to authenticated;

create policy "own profile read" on public.style_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile insert" on public.style_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile update" on public.style_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own profile delete" on public.style_profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own sizes read" on public.style_sizes for select to authenticated using ((select auth.uid()) = user_id);
create policy "own sizes insert" on public.style_sizes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own sizes update" on public.style_sizes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own sizes delete" on public.style_sizes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own memories read" on public.style_memories for select to authenticated using ((select auth.uid()) = user_id);
create policy "own memories insert" on public.style_memories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own memories update" on public.style_memories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own memories delete" on public.style_memories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own saved products read" on public.saved_products for select to authenticated using ((select auth.uid()) = user_id);
create policy "own saved products insert" on public.saved_products for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own saved products delete" on public.saved_products for delete to authenticated using ((select auth.uid()) = user_id);
