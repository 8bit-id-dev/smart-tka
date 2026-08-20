-- DEBUG (temporary): expose sid/school/pool_counts in smart_attempt_start response to diagnose items:[]
create or replace function public.smart_attempt_start(p_package_id uuid, p_token text)
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
  per_type jsonb;
  arr_materi text[];
  arr_diffs int[];
  picked_ids uuid[] := array[]::uuid[];
  t text;
  n int;
  obj jsonb;
begin
  sid := public.current_profile_id();
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

  if att.id is null then
    dur := coalesce(pkg.duration_sec, 15 * 60);
    insert into public.attempts (
      package_id, student_id, status, started_at, ends_at, session_token, last_heartbeat, tab_leave_count
    ) values (
      p_package_id, sid, 'in_progress', now(), now() + make_interval(secs => dur), p_token, now(), 0
    ) returning * into att;
  else
    if att.session_token <> p_token then
      if att.last_heartbeat is not null and att.last_heartbeat > now() - interval '45 seconds' then
        return jsonb_build_object('ok', false, 'error', 'Sesi sudah berjalan di tab/perangkat lain. Tutup tab itu atau tunggu 45 detik.');
      end if;
      update public.attempts
      set session_token = p_token, last_heartbeat = now()
      where id = att.id;
    end if;
  end if;

  payload := '[]'::jsonb;

  if pkg.use_ai_selection then
    arr_materi := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(pkg.ai_config->'materi','[]'::jsonb)) x), array[]::text[]);
    arr_diffs  := coalesce((select array_agg(x::int) from jsonb_array_elements_text(coalesce(pkg.ai_config->'difficulties','[]'::jsonb)) x), array[]::int[]);
    qty := coalesce((pkg.ai_config->>'jumlah_soal')::int, pkg.item_count);
    if qty is null or qty < 1 then qty := 10; end if;
    per_type := pkg.ai_config->'jumlah_per_type';

    if per_type is not null and per_type::text <> '{}'::text then
      for t in (select jsonb_object_keys(per_type)) loop
        n := coalesce((per_type->>t)::int, 0);
        if n > 0 then
          for obj in
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
            )
            from public.items i
            where (pkg.mapel is null or i.mapel = pkg.mapel)
              and (array_length(arr_materi,1) = 0 or i.materi = any(arr_materi))
              and i.item_type = t
              and (array_length(arr_diffs,1) = 0 or i.difficulty = any(arr_diffs))
              and not i.id = any(picked_ids)
            order by random()
            limit n
          loop
            payload := payload || obj;
            picked_ids := picked_ids || (obj->>'id')::uuid;
          end loop;
        end if;
      end loop;
    end if;

    -- Fallback: isi hingga qty dari pool yang tersisa (COALESCE karena array kosong -> NULL)
    if coalesce(array_length(picked_ids,1),0) < qty then
      for obj in
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
        )
        from public.items i
        where (pkg.mapel is null or i.mapel = pkg.mapel)
          and (array_length(arr_materi,1) = 0 or i.materi = any(arr_materi))
          and (array_length(arr_diffs,1) = 0 or i.difficulty = any(arr_diffs))
          and not i.id = any(picked_ids)
        order by random()
        limit (qty - coalesce(array_length(picked_ids,1),0))
      loop
        payload := payload || obj;
        picked_ids := picked_ids || (obj->>'id')::uuid;
      end loop;
    end if;
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
    'items', payload,
    '_debug', jsonb_build_object(
      'sid', sid,
      'school_id', current_school_id(),
      'pkg_school_id', pkg.school_id,
      'pkg_mapel', pkg.mapel,
      'per_type_cfg', per_type,
      'arr_materi', arr_materi,
      'readable_pool_per_type', (
        select jsonb_object_agg(r.t, r.c)
        from (
          select i.item_type as t, count(*) as c
          from public.items i
          where (pkg.mapel is null or i.mapel = pkg.mapel)
            and (array_length(arr_materi,1) = 0 or i.materi = any(arr_materi))
            and (array_length(arr_diffs,1) = 0 or i.difficulty = any(arr_diffs))
            and ((i.scope = 'smart' and i.status = 'published') or i.school_id = current_school_id() or i.author_id = current_profile_id())
          group by i.item_type
        ) r
      )
    )
  );
end;
$function$;
