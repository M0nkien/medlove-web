-- Medlove V6.2: idempotentné evidovanie transakčných e-mailov.
-- Táto migrácia nemení existujúce objednávky ani platby.
create table if not exists public.email_deliveries (
 order_id uuid not null references public.orders(id) on delete cascade,
 kind text not null check (kind in ('customer','owner')),
 status text not null default 'sending' check (status in ('sending','sent')),
 locked_at timestamptz not null default now(),
 sent_at timestamptz,
 provider_id text,
 primary key (order_id,kind)
);
alter table public.email_deliveries enable row level security;
revoke all on table public.email_deliveries from public,anon,authenticated;
grant select,insert,update,delete on table public.email_deliveries to service_role;
comment on table public.email_deliveries is 'Server-side email outbox; accessible only with Supabase service role.';
