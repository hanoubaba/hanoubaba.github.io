-- ============================================================
-- 无限拟合模型 · Supabase 数据库脚本（唯一维护文件）
--
-- 用法：Supabase 控制台 → SQL Editor → 全选复制本文件 → Run
-- 可重复执行，不会清空已有数据

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- 1. 策略表（前台保存 / 后台管理 / 数据统计）
-- ------------------------------------------------------------

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  strategy_name text not null,
  position_side text not null,

  input_price numeric not null,
  input_stop_loss numeric not null,
  entry_price numeric not null,
  quantity numeric not null,
  take_profit_price numeric not null,
  stop_loss_price numeric not null,

  open_cost numeric not null,
  price_adjustment_rate numeric not null default 0,
  price_adjustment numeric not null,
  concessions jsonb not null default '[]'::jsonb,
  take_profit_r_multiple numeric not null default 1,

  timeframe text not null,
  timeframe_minutes integer not null,
  valid_periods integer not null default 9,
  duration_minutes integer not null,
  start_at timestamptz not null,
  expires_at timestamptz not null,

  outcome_status text not null default 'pending',
  outcome_remark text not null default '',

  constraint strategies_position_side_check
    check (position_side in ('long', 'short')),
  constraint strategies_timeframe_check
    check (timeframe in ('1h', '4h')),
  constraint strategies_outcome_status_check
    check (outcome_status in ('pending', 'profit', 'loss', 'not_filled')),
  constraint strategies_positive_values_check
    check (
      input_price > 0
      and input_stop_loss > 0
      and input_price <> input_stop_loss
      and entry_price > 0
      and quantity > 0
      and take_profit_price > 0
      and stop_loss_price > 0
      and open_cost > 0
      and price_adjustment_rate >= 0
      and take_profit_r_multiple > 0
      and timeframe_minutes > 0
      and valid_periods > 0
      and duration_minutes > 0
    ),
  constraint strategies_side_price_check
    check (
      (position_side = 'long' and entry_price > stop_loss_price)
      or (position_side = 'short' and entry_price < stop_loss_price)
    ),
  constraint strategies_take_profit_direction_check
    check (
      (position_side = 'long' and take_profit_price > entry_price)
      or (position_side = 'short' and take_profit_price < entry_price)
    ),
  constraint strategies_duration_minutes_check
    check (duration_minutes = timeframe_minutes * valid_periods),
  constraint strategies_time_range_check
    check (
      expires_at > start_at
      and expires_at = start_at + duration_minutes * interval '1 minute'
    )
);

create index if not exists strategies_created_at_idx
on public.strategies (created_at desc);

create index if not exists strategies_strategy_name_trgm_idx
on public.strategies
using gin (strategy_name gin_trgm_ops);

create index if not exists strategies_expires_at_created_at_idx
on public.strategies (expires_at, created_at desc);

create index if not exists strategies_outcome_status_created_at_idx
on public.strategies (outcome_status, created_at desc);

create index if not exists strategies_position_side_created_at_idx
on public.strategies (position_side, created_at desc);

create index if not exists strategies_timeframe_created_at_idx
on public.strategies (timeframe, created_at desc);

create index if not exists strategies_timeframe_outcome_status_created_at_idx
on public.strategies (timeframe, outcome_status, created_at desc);

create or replace function public.get_strategy_stats(
  p_name_search text default null,
  p_timeframe text default null,
  p_outcome_status text default null,
  p_time_filter text default 'all',
  p_today_start timestamptz default null,
  p_today_end timestamptz default null,
  p_now timestamptz default null
)
returns table (
  total_count bigint,
  profit_count bigint,
  loss_count bigint,
  opened_count bigint,
  win_rate numeric,
  open_rate numeric
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select outcome_status
    from public.strategies
    where (
      nullif(trim(coalesce(p_name_search, '')), '') is null
      or strategy_name ilike '%' || trim(p_name_search) || '%'
    )
      and (
        p_timeframe is null
        or p_timeframe = 'all'
        or timeframe = p_timeframe
      )
      and (
        p_outcome_status is null
        or p_outcome_status = 'all'
        or outcome_status = p_outcome_status
      )
      and (
        coalesce(p_time_filter, 'all') = 'all'
        or (
          p_time_filter = 'active'
          and expires_at > coalesce(p_now, now())
          and (p_outcome_status is not null and p_outcome_status <> 'all' or outcome_status = 'pending')
        )
        or (
          p_time_filter = 'dueToday'
          and p_today_start is not null
          and p_today_end is not null
          and expires_at >= p_today_start
          and expires_at < p_today_end
          and (p_outcome_status is not null and p_outcome_status <> 'all' or outcome_status = 'pending')
        )
        or (
          p_time_filter = 'createdToday'
          and p_today_start is not null
          and p_today_end is not null
          and created_at >= p_today_start
          and created_at < p_today_end
        )
      )
  ),
  counted as (
    select
      count(*) as total_count,
      count(*) filter (where outcome_status = 'profit') as profit_count,
      count(*) filter (where outcome_status = 'loss') as loss_count
    from filtered
  )
  select
    total_count,
    profit_count,
    loss_count,
    profit_count + loss_count as opened_count,
    case
      when profit_count + loss_count > 0
        then round((profit_count::numeric / (profit_count + loss_count)) * 100, 2)
      else 0
    end as win_rate,
    case
      when total_count > 0
        then round(((profit_count + loss_count)::numeric / total_count) * 100, 2)
      else 0
    end as open_rate
  from counted;
$$;

create or replace function public.get_recent_10_stats()
returns table (
  total_count bigint,
  profit_count bigint,
  loss_count bigint,
  not_filled_count bigint,
  pending_count bigint,
  opened_count bigint,
  win_rate numeric,
  open_rate numeric
)
language sql
stable
set search_path = public
as $$
  with recent_10 as (
    select outcome_status
    from public.strategies
    order by created_at desc
    limit 10
  ),
  counted as (
    select
      count(*) as total_count,
      count(*) filter (where outcome_status = 'profit') as profit_count,
      count(*) filter (where outcome_status = 'loss') as loss_count,
      count(*) filter (where outcome_status = 'not_filled') as not_filled_count,
      count(*) filter (where outcome_status = 'pending') as pending_count
    from recent_10
  )
  select
    total_count,
    profit_count,
    loss_count,
    not_filled_count,
    pending_count,
    profit_count + loss_count as opened_count,
    case
      when profit_count + loss_count > 0
        then round((profit_count::numeric / (profit_count + loss_count)) * 100, 2)
      else 0
    end as win_rate,
    case
      when total_count > 0
        then round(((profit_count + loss_count)::numeric / total_count) * 100, 2)
      else 0
    end as open_rate
  from counted;
$$;

-- ------------------------------------------------------------
-- 2. 观测日志表
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 3. 公共触发器
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists strategies_set_updated_at on public.strategies;
create trigger strategies_set_updated_at
before update on public.strategies
for each row
execute function public.set_updated_at();

drop trigger if exists observation_records_set_updated_at on public.observation_records;
create trigger observation_records_set_updated_at
before update on public.observation_records
for each row
execute function public.set_updated_at();

drop function if exists public.set_observation_records_updated_at();

-- ------------------------------------------------------------
-- 4. 登录权限（仅登录用户可读写，未登录无法调用接口）
-- ------------------------------------------------------------

alter table public.strategies enable row level security;
alter table public.observation_records enable row level security;

drop policy if exists "allow anon select strategies" on public.strategies;
drop policy if exists "allow anon insert strategies" on public.strategies;
drop policy if exists "allow anon update strategies" on public.strategies;
drop policy if exists "allow anon delete strategies" on public.strategies;

drop policy if exists "allow authenticated all strategies" on public.strategies;
create policy "allow authenticated all strategies"
on public.strategies
for all
to authenticated
using (true)
with check (true);

drop policy if exists "allow anon select observation_records" on public.observation_records;
drop policy if exists "allow anon insert observation_records" on public.observation_records;
drop policy if exists "allow anon delete observation_records" on public.observation_records;

drop policy if exists "allow authenticated all observation_records" on public.observation_records;
create policy "allow authenticated all observation_records"
on public.observation_records
for all
to authenticated
using (true)
with check (true);

revoke execute on function public.get_strategy_stats(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) from anon;

grant execute on function public.get_strategy_stats(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) to authenticated;

revoke execute on function public.get_recent_10_stats() from anon;
grant execute on function public.get_recent_10_stats() to authenticated;

-- ------------------------------------------------------------
-- 5. 结构升级（表已存在时补字段/约束，不删数据）
-- ------------------------------------------------------------

alter table public.strategies
drop constraint if exists strategies_outcome_status_check;

alter table public.strategies
add constraint strategies_outcome_status_check
check (outcome_status in ('pending', 'profit', 'loss', 'not_filled'));

alter table public.strategies
add column if not exists concessions jsonb not null default '[]'::jsonb;

alter table public.strategies
add column if not exists outcome_remark text not null default '';

notify pgrst, 'reload schema';
