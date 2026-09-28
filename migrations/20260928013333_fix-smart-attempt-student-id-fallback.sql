-- Perbaikan smart_attempt_start: tambah parameter p_student_id opsional
-- sebagai fallback ketika JWT sub claim tidak terbaca (current_profile_id() = NULL).
-- Frontend akan mengirim studentId (profile.id) sebagai p_student_id.

create or replace function public.smart_attempt_start(p_package_id uuid, p_token text, p_student_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  sid uuid;
  pkg public.packages%rowtype;
  att public.attempts%rowtype;
  dur int;
  payload jsonb;
  qty int;
  arr_materi text[];
  arr_types text[];
  arr_diffs int[];
begin
  -- Coba dapatkan profile_id dari JWT, fallback ke p_student_id
  sid := public.current_profile_id();
  if sid is null and p_student_id is not null then
    sid := p_student_id;
  end if;
  if sid is null then
    return jsonb_build_object('ok', false, 'error', 'Profil tidak dikenali.');
  end if;
  if p_token is null or length(p_token) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Token sesi kosong.');
  end if;

  select * into pkg from public.packages where id = p_package_id;
  if pkg.id is null then
    return jsonb_build_object('ok', false, 'error', 'Paket tidak ada.');
  end if;

  select * into att
  from public.attempts
  where student_id = sid and package_id = p_package_id and status = 'in_progress'
  order by started_at desc
  limit 1;

  if att.id is not null then
    if att.session_token = p_token then
      null;
    elsif att.last_heartbeat is not null and att.last_heartbeat > now() - interval '45 seconds' then
      return jsonb_build_object('ok', false, 'error', 'Sesi sudah berjalan di tab/perangkat lain. Tutup tab itu atau tunggu 45 detik.');
    else
      update public.attempts
      set session_token = p_token, last_heartbeat = now()
      where id = att.id;
      att.session_token := p_token;
    end if;
  else
    dur := coalesce(pkg.duration_sec, 15 * 60);
    insert into public.attempts (
      package_id, student_id, status, started_at, ends_at, session_token, last_heartbeat, tab_leave_count
    ) values (
      p_package_id, sid, 'in_progress', now(), now() + make_interval(secs => dur), p_token, now(), 0
    ) returning * into att;
  end if;

  if pkg.use_ai_selection then
    qty := (pkg.ai_config->>'jumlah_soal')::int;
    if qty is null then qty := pkg.item_count; end if;
    if qty is null or qty < 1 then qty := 10; end if;

    arr_materi := coalesce((select array_agg(x) from jsonb_array_elements_text(pkg.ai_config->'materi') x), array[]::text[]);
    arr_types  := coalesce((select array_agg(x) from jsonb_array_elements_text(pkg.ai_config->'item_types') x), array[]::text[]);
    arr_diffs  := coalesce((select array_agg(x::int) from jsonb_array_elements_text(pkg.ai_config->'difficulties') x), array[]::int[]);

    select coalesce(jsonb_agg(x.obj), '[]'::jsonb) into payload
    from (
      select jsonb_build_object(
        'id',          i.id,
        'item_type',   i.item_type,
        'mapel',       i.mapel,
        'stem',        i.stem,
        'stimulus',    i.stimulus,
        'choices',     i.choices,
        'jenjang',     i.jenjang,
        'correct_key', '',
        'rationale',   ''
      ) as obj
      from public.items i
      where (pkg.mapel is null or i.mapel = pkg.mapel)
        and (coalesce(array_length(arr_materi,1),0) = 0 or i.materi = any(arr_materi))
        and (coalesce(array_length(arr_types,1),0)  = 0 or i.item_type = any(arr_types))
        and (coalesce(array_length(arr_diffs,1),0)  = 0 or i.difficulty = any(arr_diffs))
      order by random()
      limit qty
    ) x;
  else
    select coalesce(jsonb_agg(x.obj order by x.pos), '[]'::jsonb) into payload
    from (
      select
        pi.position as pos,
        jsonb_build_object(
          'id',          i.id,
          'item_type',   i.item_type,
          'mapel',       i.mapel,
          'stem',        i.stem,
          'stimulus',    i.stimulus,
          'choices',     i.choices,
          'jenjang',     i.jenjang,
          'correct_key', '',
          'rationale',   ''
        ) as obj
      from public.package_items pi
      join public.items i on i.id = pi.item_id
      where pi.package_id = p_package_id
    ) x;
  end if;

  return jsonb_build_object(
    'ok', true,
    'attempt_id', att.id,
    'ends_at', att.ends_at,
    'tab_leave_count', att.tab_leave_count,
    'items', payload
  );
end;
$function$;