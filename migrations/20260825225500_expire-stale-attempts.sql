-- Menutup sesi ujian in_progress yang sudah melewati ends_at (stale/expired)
-- sehingga constraint one-active-attempt tidak memblokir siswa selamanya.
-- smart_attempt_start juga meng-expire attempt kadaluarsa saat siswa mulai ulang.
create or replace function public.expire_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  n integer;
begin
  update public.attempts
    set status = 'expired', submitted_at = coalesce(submitted_at, now())
    where status = 'in_progress'
      and ends_at is not null
      and ends_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$function$;