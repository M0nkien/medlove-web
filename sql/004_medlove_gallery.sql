-- Medlove V7: gallery of real farm photographs; no demo or third-party images.
create table if not exists public.farm_gallery (
 id uuid primary key default gen_random_uuid(),
 image_url text not null check (length(image_url) between 1 and 2000),
 storage_path text not null unique check (storage_path like 'gallery/%'),
 caption text not null default '' check (length(caption)<=200),
 category text not null default 'Zo života farmy'
   check (category in ('Úle','Zber medu','Balenie','Zo života farmy')),
 sort_order integer not null default 0,
 published boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.farm_gallery enable row level security;
revoke all on public.farm_gallery from anon,authenticated;
grant select on public.farm_gallery to anon;
grant select,insert,update,delete on public.farm_gallery to authenticated;
drop policy if exists gallery_visitor_read on public.farm_gallery;
create policy gallery_visitor_read on public.farm_gallery for select to anon using(published=true);
drop policy if exists gallery_admin_read on public.farm_gallery;
create policy gallery_admin_read on public.farm_gallery for select to authenticated using(published=true or public.is_admin());
drop policy if exists gallery_admin_insert on public.farm_gallery;
create policy gallery_admin_insert on public.farm_gallery for insert to authenticated with check(public.is_admin());
drop policy if exists gallery_admin_update on public.farm_gallery;
create policy gallery_admin_update on public.farm_gallery for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists gallery_admin_delete on public.farm_gallery;
create policy gallery_admin_delete on public.farm_gallery for delete to authenticated using(public.is_admin());
