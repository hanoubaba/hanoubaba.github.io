create extension if not exists pgcrypto;

create table if not exists public.observation_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  content text not null,

  constraint observation_records_content_not_blank_check
    check (length(trim(content)) > 0)
);

create index if not exists observation_records_created_at_idx
on public.observation_records (created_at desc);

create or replace function public.set_observation_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists observation_records_set_updated_at on public.observation_records;

create trigger observation_records_set_updated_at
before update on public.observation_records
for each row
execute function public.set_observation_records_updated_at();

alter table public.observation_records enable row level security;

drop policy if exists "allow anon select observation_records" on public.observation_records;
create policy "allow anon select observation_records"
on public.observation_records
for select
to anon
using (true);

drop policy if exists "allow anon insert observation_records" on public.observation_records;
create policy "allow anon insert observation_records"
on public.observation_records
for insert
to anon
with check (true);

drop policy if exists "allow anon delete observation_records" on public.observation_records;
create policy "allow anon delete observation_records"
on public.observation_records
for delete
to anon
using (true);

notify pgrst, 'reload schema';
