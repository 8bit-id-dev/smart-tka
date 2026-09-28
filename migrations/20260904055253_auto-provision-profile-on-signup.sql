-- Auto-provision public.profiles saat akun auth baru dibuat,
-- supaya user langsung bisa login tanpa layar "Akun belum terhubung".
--
-- Trigger function di public (SECURITY DEFINER, search_path terkunci),
-- dipasang di auth.users AFTER INSERT — pola resmi referensi auth InsForge.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- Lewati user anonymous
  if new.is_anonymous then
    return new;
  end if;

  insert into public.profiles (user_id, full_name, is_active)
  values (
    new.id::text,
    coalesce(
      nullif(new.profile->>'name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Pengguna'
    ),
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
