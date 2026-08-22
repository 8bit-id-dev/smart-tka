-- Allow admin/guru/kepsek to update any attempt (for archive functionality)
-- Drop and recreate the existing update policy with broader permissions
drop policy if exists attempts_update_self on public.attempts;
create policy attempts_update_self on public.attempts
  for update using (
    (student_id = current_profile_id())
    or
    (current_role() = any(array['guru'::text, 'admin'::text, 'kepsek'::text]))
  ) with check (true);
