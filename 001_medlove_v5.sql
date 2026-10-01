-- Medlove V5: bezpečné rozšírenie už existujúcej databázy.
-- Spustiť iba v projekte Medlove. Nemaže produkty ani existujúce objednávky.

alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists stripe_checkout_session_id text unique;
alter table public.orders add column if not exists stripe_payment_intent_id text;

alter table public.orders drop constraint if exists orders_payment_type_check;
alter table public.orders add constraint orders_payment_type_check
  check (payment_type in ('cash','transfer','card'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid','pending','paid','failed','refunded'));

-- Zákazník nesmie vkladať objednávky priamo cez starú verejnú funkciu.
revoke all on function public.create_order(text,text,text,text,text,text,text,jsonb)
  from public, anon, authenticated;

-- Bezpečná RPC volaná iba z backendu s tajným kľúčom.
create or replace function public.create_medlove_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_delivery_type text,
  p_payment_type text,
  p_delivery_address text,
  p_note text,
  p_items jsonb
) returns table(order_id uuid, order_code text, total numeric)
language plpgsql security definer set search_path = '' as $$
declare
 v_id uuid := gen_random_uuid();
 v_code text := 'MED-' || upper(substr(replace(v_id::text,'-',''),1,12));
 v_item jsonb;
 v_product public.products%rowtype;
 v_qty integer;
 v_total_qty integer := 0;
 v_total numeric(10,2) := 0;
 v_min_qty integer := 3;
begin
 if length(trim(coalesce(p_customer_name,''))) not between 2 and 120
    or length(trim(coalesce(p_phone,''))) not between 6 and 30
    or length(coalesce(p_email,'')) > 254
    or length(coalesce(p_delivery_address,'')) > 400
    or length(coalesce(p_note,'')) > 1000
 then raise exception 'Nesprávne kontaktné údaje'; end if;
 if p_payment_type not in ('cash','card')
    or p_delivery_type not in ('pickup','local')
 then raise exception 'Neplatná voľba dopravy alebo platby'; end if;
 if p_payment_type='card' and trim(coalesce(p_email,''))=''
 then raise exception 'Pri online platbe je povinný e-mail'; end if;
 if p_delivery_type='local' and trim(coalesce(p_delivery_address,''))=''
 then raise exception 'Zadajte adresu doručenia'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
    or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>30
 then raise exception 'Neplatný košík'; end if;

 select greatest(1,free_delivery_qty) into v_min_qty
 from public.shop_settings where id=1;
 v_min_qty := coalesce(v_min_qty,3);

 insert into public.orders(
   id,order_code,customer_name,phone,email,delivery_type,payment_type,
   delivery_address,note,subtotal,delivery_price,total,status,payment_status
 ) values (
   v_id,v_code,trim(p_customer_name),trim(p_phone),nullif(trim(coalesce(p_email,'')),''),
   p_delivery_type,p_payment_type,nullif(trim(coalesce(p_delivery_address,'')),''),
   nullif(trim(coalesce(p_note,'')),''),0,0,0,'new',
   case when p_payment_type='card' then 'pending' else 'unpaid' end
 );

 -- Stabilné poradie zamykania produktov redukuje kolízie pri nákupoch.
 for v_item in
   select elem from jsonb_array_elements(p_items) as items(elem)
   order by elem->>'product_id'
 loop
   v_qty := (v_item->>'qty')::integer;
   if v_qty is null or v_qty<1 or v_qty>20
   then raise exception 'Neplatné množstvo'; end if;

   select * into v_product from public.products
   where id=(v_item->>'product_id')::uuid and active=true for update;
   if not found then raise exception 'Produkt už nie je dostupný'; end if;
   if v_product.stock<v_qty then
     raise exception 'Nedostatočný sklad: %',v_product.name;
   end if;

   insert into public.order_items(order_id,product_id,product_name,quantity,unit_price)
   values(v_id,v_product.id,v_product.name,v_qty,v_product.price);
   update public.products set stock=stock-v_qty,updated_at=now()
   where id=v_product.id;
   v_total_qty := v_total_qty+v_qty;
   v_total := v_total+v_product.price*v_qty;
 end loop;

 if p_delivery_type='local' and v_total_qty<v_min_qty
 then raise exception 'Bezplatný lokálny dovoz je možný od % kusov',v_min_qty; end if;

 update public.orders set subtotal=v_total,total=v_total,updated_at=now()
 where id=v_id;
 return query select v_id,v_code,v_total;
end;
$$;

revoke all on function public.create_medlove_order(text,text,text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.create_medlove_order(text,text,text,text,text,text,text,jsonb)
  to service_role;

-- Pri potvrdení podpisaného Stripe webhooku: iba prvá udalosť zmení stav.
create or replace function public.mark_medlove_order_paid(
  p_order_id uuid,p_session_id text,p_payment_intent text
) returns boolean language plpgsql security definer set search_path='' as $$
declare changed uuid;
begin
 update public.orders set payment_status='paid',
   stripe_payment_intent_id=p_payment_intent,updated_at=now()
 where id=p_order_id and payment_type='card' and payment_status='pending'
   and stripe_checkout_session_id=p_session_id
 returning id into changed;
 return changed is not null;
end;$$;
revoke all on function public.mark_medlove_order_paid(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.mark_medlove_order_paid(uuid,text,text)
 to service_role;

-- Vypršaná platba: vráti rezervované kusy iba raz.
create or replace function public.release_medlove_pending_order(
  p_order_id uuid,p_session_id text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare changed uuid; item record;
begin
 update public.orders set payment_status='failed',status='cancelled',updated_at=now()
 where id=p_order_id and payment_type='card' and payment_status='pending'
   and (stripe_checkout_session_id=p_session_id
        or (p_session_id is null and stripe_checkout_session_id is null))
 returning id into changed;
 if changed is null then return false; end if;
 for item in select product_id,sum(quantity)::integer as qty
   from public.order_items where order_id=changed and product_id is not null
   group by product_id
 loop
   update public.products set stock=stock+item.qty,updated_at=now()
   where id=item.product_id;
 end loop;
 return true;
end;$$;
revoke all on function public.release_medlove_pending_order(uuid,text)
 from public,anon,authenticated;
grant execute on function public.release_medlove_pending_order(uuid,text)
 to service_role;

-- Admin môže stornovať len nezaplatenú nevybavenú objednávku.
create or replace function public.cancel_medlove_admin_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed uuid; item record;
begin
 if not public.is_admin() then raise exception 'Iba administrátor'; end if;
 update public.orders set status='cancelled',updated_at=now()
 where id=p_order_id and status in ('new','processing','ready')
   and payment_status='unpaid'
 returning id into changed;
 if changed is null then return false; end if;
 for item in select product_id,sum(quantity)::integer as qty
   from public.order_items where order_id=changed and product_id is not null
   group by product_id
 loop
  update public.products set stock=stock+item.qty,updated_at=now()
  where id=item.product_id;
 end loop;
 return true;
end;$$;
revoke all on function public.cancel_medlove_admin_order(uuid)
 from public,anon;
grant execute on function public.cancel_medlove_admin_order(uuid)
 to authenticated;

-- Úložisko obrázkov: verejná galéria, zápis len adminom.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

drop policy if exists medlove_images_public_read on storage.objects;
create policy medlove_images_public_read on storage.objects
  for select to public using(bucket_id='product-images');
drop policy if exists medlove_images_admin_insert on storage.objects;
create policy medlove_images_admin_insert on storage.objects
  for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
drop policy if exists medlove_images_admin_update on storage.objects;
create policy medlove_images_admin_update on storage.objects
  for update to authenticated using(bucket_id='product-images' and public.is_admin())
  with check(bucket_id='product-images' and public.is_admin());
drop policy if exists medlove_images_admin_delete on storage.objects;
create policy medlove_images_admin_delete on storage.objects
  for delete to authenticated using(bucket_id='product-images' and public.is_admin());
