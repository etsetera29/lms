-- Student uploads: PDF and DOCX only. Existing stored submissions remain readable.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]::text[], file_size_limit = 15728640
where id = 'submissions';

-- Restrict filename extensions at the storage layer (in addition to bucket MIME rules).
-- Restrictive policies are ANDed with existing INSERT policies and do not broaden access.
drop policy if exists student_submission_pdf_docx_only on storage.objects;
create policy student_submission_pdf_docx_only
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id <> 'submissions' or name ~* '\.(pdf|docx)$'
);
