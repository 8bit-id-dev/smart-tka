-- SMART-TKA: prevent duplicate in_progress attempts per (exam, student)
-- A student may only have ONE in_progress attempt per scheduled exam / package.
-- submitted attempts are not affected (a student can have many submitted runs);
-- only the in_progress state is constrained, which is what the crash-resume path needs.

create unique index if not exists attempts_one_inprogress_per_exam_student
  on public.attempts (scheduled_exam_id, student_id)
  where status = 'in_progress';
