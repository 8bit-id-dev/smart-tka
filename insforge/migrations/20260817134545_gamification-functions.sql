-- Gamification helper functions and triggers

-- Helper: award XP to a student (call via RPC from app: SELECT public.award_xp(profile_uuid, xp_amount))
create or replace function public.award_xp(p_profile uuid, p_xp integer)
returns integer
language plpgsql
as $$
declare
  v_new_xp integer;
  v_new_level integer := 1;
  v_xp_threshold integer;
  v_date date := current_date;
  v_prev_date date;
begin
  if p_xp = 0 then
    return 0;
  end if;

  -- Insert or increment XP
  insert into public.gamification_profiles (profile_id, xp, streak_current, streak_best, last_active_date)
  values (p_profile, greatest(p_xp, 0), 1, 1, v_date)
  on conflict (profile_id) do update set
    xp = gamification_profiles.xp + p_xp,
    updated_at = now();

  -- Fetch current state
  select xp, level, last_active_date into v_new_xp, v_new_level, v_prev_date
  from public.gamification_profiles where profile_id = p_profile;

  -- Streak: consecutive active days
  if v_date = v_prev_date then
    null;
  elsif v_prev_date = v_date - interval '1 day' then
    update public.gamification_profiles
    set streak_current = streak_current + 1,
        streak_best = greatest(streak_best, streak_current + 1),
        last_active_date = v_date
    where profile_id = p_profile;
  else
    update public.gamification_profiles
    set streak_current = 1,
        last_active_date = v_date
    where profile_id = p_profile;
  end if;

  -- Level up: quadratic threshold (level N needs 50*N*(N+1)*(N+2)/6 XP total)
  -- L1:0, L2:100, L3:250, L4:450, L5:700...
  loop
    v_xp_threshold := 50 * v_new_level * (v_new_level + 1) * (v_new_level + 2) / 6;
    if v_new_xp >= v_xp_threshold then
      v_new_level := v_new_level + 1;
    else
      exit;
    end if;
  end loop;

  if v_new_level > (select level from public.gamification_profiles where profile_id = p_profile) then
    update public.gamification_profiles set level = v_new_level where profile_id = p_profile;
    -- Award level-up achievement if applicable (level-ups are achievements too)
    insert into public.user_achievements (profile_id, achievement_id)
    select p_profile, a.id
    from public.achievements a
    where a.code = 'level_' || v_new_level::text
    and not exists (
      select 1 from public.user_achievements ua
      where ua.profile_id = p_profile and ua.achievement_id = a.id
    );
  end if;

  return v_new_xp;
end;
$$;

-- Trigger: auto-award XP-based achievements after XP update
create or replace function public.check_achievements()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_achievements (profile_id, achievement_id)
  select NEW.profile_id, a.id
  from public.achievements a
  where a.criteria_type = 'xp'
    and NEW.xp >= a.criteria_value
    and not exists (
      select 1 from public.user_achievements ua
      where ua.profile_id = NEW.profile_id and ua.achievement_id = a.id
    );
  return NEW;
end;
$$;

drop trigger if exists check_achievements_trigger on public.gamification_profiles;
create trigger check_achievements_trigger
  after update of xp on public.gamification_profiles
  for each row
  execute function public.check_achievements();

-- Grant execute to authenticated users
grant execute on function public.award_xp to authenticated;
grant execute on function public.check_achievements to authenticated;
