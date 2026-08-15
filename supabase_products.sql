-- Lakhnavi Chikankari product catalogue (frontend + backend product management).
-- Run this ONCE in the Supabase SQL Editor (or via db runner). Idempotent.
-- Requires public.order_admins + public.is_order_admin() from supabase_orders.sql.

create table if not exists public.products (
  id text primary key,
  name text not null,
  price integer not null check (price >= 0),
  compare_at integer check (compare_at is null or compare_at >= 0),
  rating numeric(2,1) default 0,
  reviews integer default 0,
  badge text,
  image text,
  category text default '',
  sku text,
  colour text,
  craft text,
  fabric text,
  fit text,
  occasion text,
  description text,
  details jsonb default '[]'::jsonb,
  active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists products_active_sort_idx on public.products (active, sort_order);
create index if not exists products_active_category_idx on public.products (active, category);

alter table public.products enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
drop policy if exists "Admins can view all products" on public.products;
drop policy if exists "Admins can add products" on public.products;
drop policy if exists "Admins can edit products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

create policy "Anyone can view active products"
  on public.products for select
  to anon, authenticated
  using (active = true);

create policy "Admins can view all products"
  on public.products for select
  to authenticated
  using (public.is_order_admin());

create policy "Admins can add products"
  on public.products for insert
  to authenticated
  with check (public.is_order_admin());

create policy "Admins can edit products"
  on public.products for update
  to authenticated
  using (public.is_order_admin())
  with check (public.is_order_admin());

create policy "Admins can delete products"
  on public.products for delete
  to authenticated
  using (public.is_order_admin());

revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon;
grant select, insert, update, delete on table public.products to authenticated;

-- Photo uploads live in the public storage bucket "product-images".
-- Anyone can view images; only approved admins can upload/replace/delete them.

drop policy if exists "Anyone can view product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can replace product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;

create policy "Anyone can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_order_admin());

create policy "Admins can replace product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_order_admin())
  with check (bucket_id = 'product-images' and public.is_order_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_order_admin());

grant select on table storage.objects to anon, authenticated;
grant insert, update, delete on table storage.objects to authenticated;
