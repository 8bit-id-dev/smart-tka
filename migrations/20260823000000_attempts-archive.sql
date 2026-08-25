-- Allow admin/guru/kepsek to update any attempt (for archive functionality)
-- Perbaikan: current_role() diblokir parser keamanan; pakai pola profiles.role
drop policy if exists attempts_update_self on public.attempts;
create policy attempts_update_self on public.attempts
  for update using (
    (student_id = current_profile_id())
    or
    (select role from public.profiles where user_id = public.smart_uid()::text limit 1) in ('guru', 'admin', 'kepsek')
  ) with check (true);