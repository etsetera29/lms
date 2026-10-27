-- FCPC LMS: section onboarding for newly registered students and safe section archiving.
-- Backfill all previously registered accounts, so only future student accounts see the welcome question.
alter table public.profiles add column if not exists onboarding_complete boolean not null default false;
update public.profiles set onboarding_complete = true where onboarding_complete = false;

alter table public.class_sections add column if not exists archived_at timestamptz;

create or replace function public.registration_section_options()
returns table(section_id uuid, section_name text, course_id uuid, subject_name text)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if auth.uid() is null then raise exception 'Sign in to select a section'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='student')
  then raise exception 'Student access required'; end if;
  return query
    select s.id, s.name, c.id, c.title
    from public.class_sections s
    join public.courses c on c.id=s.course_id
    where s.archived_at is null and s.is_open and c.published
    order by c.title,s.name;
end
$fn$;

create or replace function public.complete_student_section_onboarding(p_section uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare
 v_profile record;
 v_course uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select p.id,p.role,p.onboarding_complete into v_profile
 from public.profiles p where p.id=auth.uid() for update;
 if not found or v_profile.role <> 'student' then raise exception 'Student access required'; end if;
 if v_profile.onboarding_complete then raise exception 'Initial section selection has already been completed'; end if;
 if exists(select 1 from public.section_enrollments e where e.user_id=auth.uid())
 then raise exception 'Already assigned to a section. Contact your instructor for changes'; end if;
 select s.course_id into v_course
 from public.class_sections s join public.courses c on c.id=s.course_id
 where s.id=p_section and s.archived_at is null and s.is_open and c.published;
 if v_course is null then raise exception 'This section is no longer available'; end if;
 insert into public.enrollments(user_id,course_id)
 values(auth.uid(),v_course) on conflict do nothing;
 insert into public.section_enrollments(user_id,course_id,section_id)
 values(auth.uid(),v_course,p_section);
 update public.profiles set onboarding_complete=true where id=auth.uid();
end
$fn$;

create or replace function public.skip_student_section_onboarding()
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update public.profiles set onboarding_complete=true
 where id=auth.uid() and role='student' and onboarding_complete=false;
 if not found then raise exception 'Section onboarding is already complete or not available'; end if;
end
$fn$;

create or replace function public.archive_class_section(p_section uuid, p_archive boolean)
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
 if p_archive is null then raise exception 'Choose archive or restore'; end if;
 update public.class_sections
 set archived_at=case when p_archive then now() else null end,
     is_open=false
 where id=p_section;
 if not found then raise exception 'Section not found'; end if;
end
$fn$;

-- Existing section-code enrollment must not reopen archived sections.
create or replace function public.join_section(p_code text)
returns table(section_id uuid, course_id uuid, section_name text)
language plpgsql security definer set search_path = ''
as $fn$
declare v_section public.class_sections%rowtype; v_normalized text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and role='student') then
   raise exception 'Only student accounts may enroll'; end if;
 v_normalized:=upper(trim(coalesce(p_code,'')));
 if length(v_normalized)>60 then raise exception 'Invalid enrollment code'; end if;
 select * into v_section from public.class_sections s
 where s.code_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_normalized,'UTF8')),'hex')
   and s.is_open and s.archived_at is null;
 if not found then raise exception 'Invalid or closed enrollment code'; end if;
 if exists(select 1 from public.section_enrollments se where se.user_id=auth.uid() and se.course_id=v_section.course_id)
 then raise exception 'Already enrolled in this subject'; end if;
 insert into public.section_enrollments(section_id,course_id,user_id)
 values(v_section.id,v_section.course_id,auth.uid());
 insert into public.enrollments(user_id,course_id)
 values(auth.uid(),v_section.course_id) on conflict do nothing;
 return query select v_section.id,v_section.course_id,v_section.name;
end
$fn$;

revoke all on function public.registration_section_options() from public,anon;
revoke all on function public.complete_student_section_onboarding(uuid) from public,anon;
revoke all on function public.skip_student_section_onboarding() from public,anon;
revoke all on function public.archive_class_section(uuid,boolean) from public,anon;
grant execute on function public.registration_section_options() to authenticated;
grant execute on function public.complete_student_section_onboarding(uuid) to authenticated;
grant execute on function public.skip_student_section_onboarding() to authenticated;
grant execute on function public.archive_class_section(uuid,boolean) to authenticated;
