-- Storage buckets and access policies. Idempotent.
-- Path conventions (first folder decides ownership):
--   student-documents/<student_id>/...      submissions/<student_id>/<assignment_id>/...
--   reports/<student_id>/...                materials/<any>      message-attachments/<thread_id>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('brand', 'brand', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('blog', 'blog', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('handouts', 'handouts', true, 20971520, array['application/pdf','image/png','image/jpeg','image/webp']),
  ('materials', 'materials', false, 52428800, array['application/pdf','image/png','image/jpeg','image/webp',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-powerpoint','application/msword','text/plain']),
  ('student-documents', 'student-documents', false, 20971520, array['application/pdf','image/png','image/jpeg','image/webp']),
  ('submissions', 'submissions', false, 20971520, array['application/pdf','image/png','image/jpeg','image/webp',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']),
  ('reports', 'reports', false, 10485760, array['application/pdf']),
  ('message-attachments', 'message-attachments', false, 10485760, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$ declare r record; begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects' and policyname like 'ta_%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Owner manages every academy bucket.
create policy ta_owner_all on storage.objects for all to authenticated
  using (bucket_id in ('brand','blog','handouts','materials','student-documents','submissions','reports','message-attachments')
         and public.is_owner())
  with check (bucket_id in ('brand','blog','handouts','materials','student-documents','submissions','reports','message-attachments')
              and public.is_owner());

-- Public buckets are readable by anyone.
create policy ta_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('brand','blog','handouts'));

-- Student-scoped private buckets: the student and verified parents may read.
create policy ta_family_read on storage.objects for select to authenticated
  using (bucket_id in ('student-documents','submissions','reports')
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.can_view_student(((storage.foldername(name))[1])::uuid));

-- Students upload only into their own submissions folder, for an assignment they hold.
create policy ta_student_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions'
              and (storage.foldername(name))[1] = auth.uid()::text
              and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
              and public.student_has_assignment(((storage.foldername(name))[2])::uuid, auth.uid()));

-- Private materials: readable when the matching materials row is visible to the caller
-- (the materials table's own RLS applies inside this subquery).
create policy ta_material_read on storage.objects for select to authenticated
  using (bucket_id = 'materials'
         and exists (select 1 from public.materials m where m.bucket = 'materials' and m.path = name));

-- Message attachments: thread participant only (plus Owner via ta_owner_all).
create policy ta_attachment_read on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments'
         and exists (select 1 from public.message_threads t
                     where t.id::text = (storage.foldername(name))[1] and t.participant_id = auth.uid()));
create policy ta_attachment_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments'
              and exists (select 1 from public.message_threads t
                          where t.id::text = (storage.foldername(name))[1] and t.participant_id = auth.uid()));
