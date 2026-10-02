-- V7.2 private tracking and order audit: applied to project Medlove.
alter table public.orders add column if not exists tracking_token text;
update public.orders set tracking_token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','') where tracking_token is null;
alter table public.orders alter column tracking_token set default(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
alter table public.orders alter column tracking_token set not null;
create unique index if not exists medlove_orders_tracking_token_unique on public.orders(tracking_token);
create table if not exists public.order_events(
 id bigint generated always as identity primary key,
 order_id uuid not null references public.orders(id) on delete cascade,
 event_type text not null check(event_type in ('created','status','payment')),
 old_value text,new_value text not null,actor_id uuid,
 actor_type text not null check(actor_type in ('admin','system')),
 created_at timestamptz not null default now()
);
create index if not exists medlove_events_order_time on public.order_events(order_id,created_at);
alter table public.order_events enable row level security;
revoke all on public.order_events from anon,authenticated;
grant select on public.order_events to authenticated;
drop policy if exists events_admin_read on public.order_events;
create policy events_admin_read on public.order_events for select to authenticated using(public.is_admin());
create or replace function public.record_medlove_order_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;
begin
 v_actor:=auth.uid();
 if tg_op='INSERT' then
  insert into public.order_events(order_id,event_type,new_value,actor_id,actor_type)
   values(new.id,'created',new.status,v_actor,case when v_actor is null then 'system' else 'admin' end);
 else
  if old.status is distinct from new.status then
   insert into public.order_events(order_id,event_type,old_value,new_value,actor_id,actor_type)
    values(new.id,'status',old.status,new.status,v_actor,case when v_actor is null then 'system' else 'admin' end);
  end if;
  if old.payment_status is distinct from new.payment_status then
   insert into public.order_events(order_id,event_type,old_value,new_value,actor_id,actor_type)
    values(new.id,'payment',old.payment_status,new.payment_status,v_actor,case when v_actor is null then 'system' else 'admin' end);
  end if;
 end if;
 return new;
end;$$;
revoke all on function public.record_medlove_order_event() from public,anon,authenticated;
drop trigger if exists medlove_order_event_insert on public.orders;
create trigger medlove_order_event_insert after insert on public.orders
 for each row execute function public.record_medlove_order_event();
drop trigger if exists medlove_order_event_update on public.orders;
create trigger medlove_order_event_update after update of status,payment_status on public.orders
 for each row execute function public.record_medlove_order_event();
create table if not exists public.restock_subscriptions(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 email text not null check(length(email) between 5 and 254),
 created_at timestamptz not null default now(),notified_at timestamptz,
 unique(product_id,email)
);
create index if not exists medlove_restock_pending on public.restock_subscriptions(product_id) where notified_at is null;
alter table public.restock_subscriptions enable row level security;
revoke all on public.restock_subscriptions from public,anon,authenticated;
insert into public.order_events(order_id,event_type,new_value,actor_type,created_at)
select o.id,'created',o.status,'system',o.created_at from public.orders o
where not exists(select 1 from public.order_events e where e.order_id=o.id and e.event_type='created');
