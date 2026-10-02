-- V7.2 multiple product photographs: applied to project Medlove.
create table if not exists public.product_photos(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 image_url text not null check(length(image_url) between 1 and 2000),
 storage_path text not null unique check(storage_path like 'products/%'),
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists medlove_product_photos_product_order on public.product_photos(product_id,sort_order);
alter table public.product_photos enable row level security;
revoke all on public.product_photos from anon,authenticated;
grant select on public.product_photos to anon;
grant select,insert,delete on public.product_photos to authenticated;
drop policy if exists product_photos_public_read on public.product_photos;
create policy product_photos_public_read on public.product_photos for select to anon
 using(exists(select 1 from public.products p where p.id=product_id and p.active=true));
drop policy if exists product_photos_admin_read on public.product_photos;
create policy product_photos_admin_read on public.product_photos for select to authenticated
 using(public.is_admin() or exists(select 1 from public.products p where p.id=product_id and p.active=true));
drop policy if exists product_photos_admin_add on public.product_photos;
create policy product_photos_admin_add on public.product_photos for insert to authenticated with check(public.is_admin());
drop policy if exists product_photos_admin_remove on public.product_photos;
create policy product_photos_admin_remove on public.product_photos for delete to authenticated using(public.is_admin());
