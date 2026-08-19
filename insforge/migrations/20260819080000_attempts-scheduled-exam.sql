-- SMART-TKA: link attempts to scheduled exams so a ujian can be resumed safely
-- (anti-cheat: resume only while the schedule window is still open and the attempt is in_progress)

alter table public.attempts
  add column if not exists scheduled_exam_id uuid references public.exam_schedules(id);

create index if not exists attempts_scheduled_exam_idx on public.attempts(scheduled_exam_id, student_id, status);

-- Resume rule: an attempt may be resumed only if
-- 1. it is linked to an exam schedule,
-- 2. the attempt status is still in_progress,
-- 3. the schedule window (start_at <= nol now <= end_at) is still open.
create or replace function public.exam_resume_allowed(p_attempt_id uuid)
returns boolean
language sql
stable
as $$
  select
    a.status = 'in_progress'
    and a.scheduled_exam_id is not null
    and exists (
      select 1 from public.exam_schedules s
      where s.id = a.scheduled_exam_id
        and s.is_active = true
        and s.start_at <= now()
        and s.end_at >= now()
    )
  from public.attempts a
  where a.id = p_attempt_id
  limit 1;
$$;

grant execute on function public.exam_resume_allowed to authenticated;
