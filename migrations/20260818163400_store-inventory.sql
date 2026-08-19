-- SMART-TKA: in-app store inventory (tracks owned items per user, purchased with XP)

create table if not exists public.store_inventory (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id    text not NULL,
  purchased_at timestamptz not null default now()
);

create unique index if not exists store_inventory_pkey on public.store_inventory(profile_id, item_id);
create index if not exists store_inventory_profile_idx on public.store_inventory(profile_id);
create index if not exists store_inventory_item_idx on public.store_inventory(item_id);

alter table public.store_inventory enable row level security;

drop policy if exists si_read on public.store_inventory;
create policy si_read on public.store_inventory
  for select using (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
  );

drop policy if exists si_manage on public.store_inventory;
create policy si_manage on public.store_inventory
  for all using (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
  )
  with check (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
  );

grant select on public.store_inventory to authenticated;
