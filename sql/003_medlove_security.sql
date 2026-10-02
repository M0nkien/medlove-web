-- Medlove V6.5: restrict data access without modifying existing records.
revoke all privileges on table public.orders from anon;
revoke all privileges on table public.order_items from anon;
revoke all privileges on table public.admins from anon;
revoke all privileges on table public.orders from authenticated;
grant select on table public.orders to authenticated;
grant update(status,updated_at) on table public.orders to authenticated;
drop policy if exists orders_admin_delete on public.orders;
revoke all privileges on table public.order_items from authenticated;
grant select on table public.order_items to authenticated;
revoke insert,update,delete,truncate,references,trigger,maintain on table public.products from anon;
revoke insert,update,delete,truncate,references,trigger,maintain on table public.shop_settings from anon;
-- SECURITY DEFINER order RPCs and service_role privileges are unchanged.
