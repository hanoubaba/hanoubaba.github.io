create extension if not exists pgcrypto;

create table if not exists public.lunch_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  selected_at timestamptz not null,
  category text not null,
  name text not null,

  constraint lunch_orders_category_not_blank_check
    check (length(trim(category)) > 0),
  constraint lunch_orders_name_not_blank_check
    check (length(trim(name)) > 0)
);

create index if not exists lunch_orders_created_at_idx
on public.lunch_orders (created_at desc);

create index if not exists lunch_orders_selected_at_idx
on public.lunch_orders (selected_at desc);

create index if not exists lunch_orders_category_created_at_idx
on public.lunch_orders (category, created_at desc);

alter table public.lunch_orders enable row level security;

drop policy if exists "allow anon select lunch_orders" on public.lunch_orders;
create policy "allow anon select lunch_orders"
on public.lunch_orders
for select
to anon
using (true);

drop policy if exists "allow anon insert lunch_orders" on public.lunch_orders;
create policy "allow anon insert lunch_orders"
on public.lunch_orders
for insert
to anon
with check (true);

notify pgrst, 'reload schema';
