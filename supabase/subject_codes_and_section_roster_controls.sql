-- FCPC Learning Hub: subject self-enrollment and controlled section rosters.
-- Backwards-compatible with existing courses, grades, submissions, and section codes.
create table if not exists public.subject_join_codes (
  course_id uuid primary key references public.courses(id) on delete cascade,
  code_hash text not null unique,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.subject_join_codes enable row level security;
revoke all on table public.subject_join_codes from public, anon, authenticated;

create or replace function public.create_subject(
  p_code text, p_title text, p_description text default '', p_color text default 'violet'
)
returns table(course_id uuid,enrollment_code text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_academic_code text := upper(trim(coalesce(p_code,'')));
  v_title text := trim(coalesce(p_title,''));
  v_slug text;
  v_id uuid;
  v_join_code text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  if v_academic_code !~ '^[A-Z0-9][A-Z0-9 -]{1,23}$' then raise exception 'Subject code must be 2-24 letters, numbers, spaces or hyphens'; end if;
  if char_length(v_title) not between 3 and 120 then raise exception 'Subject title must be 3-120 characters'; end if;
  if char_length(coalesce(p_description,'')) > 1200 then raise exception 'Subject description is too long'; end if;
  if p_color not in ('violet','blue','green','amber') then raise exception 'Invalid subject color'; end if;
  v_slug:=lower(replace(v_academic_code,' ','-'));
  insert into public.courses(code,slug,title,description,color,published)
  values(v_academic_code,v_slug,v_title,trim(coalesce(p_description,'')),p_color,true)
  returning id into v_id;
  v_join_code:='SUB-'||upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,24));
  insert into public.subject_join_codes(course_id,code_hash)
  values(v_id,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_join_code,'UTF8')),'hex'));
  return query select v_id,v_join_code;
end;
$function$;

create or replace function public.rotate_subject_code(p_course_id uuid)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_code text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  if not exists(select 1 from public.courses where id=p_course_id) then raise exception 'Subject not found'; end if;
  v_code:='SUB-'||upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,24));
  insert into public.subject_join_codes(course_id,code_hash,is_open)
  values(p_course_id,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_code,'UTF8')),'hex'),true)
  on conflict (course_id) do update
  set code_hash=excluded.code_hash, created_at=now();
  return v_code;
end;
$function$;

create or replace function public.set_subject_join_open(p_course_id uuid,p_open boolean)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_open is null then raise exception 'Choose an enrollment status'; end if;
  update public.subject_join_codes set is_open=p_open where course_id=p_course_id;
  if not found then raise exception 'Generate a subject enrollment code first'; end if;
end;
$function$;

create or replace function public.subject_code_status()
returns table(course_id uuid,has_code boolean,is_open boolean)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  return query select c.id,(k.course_id is not null),coalesce(k.is_open,false)
  from public.courses c left join public.subject_join_codes k on k.course_id=c.id
  order by c.title;
end;
$function$;

create or replace function public.join_subject(p_code text)
returns table(course_id uuid,subject_title text)
language plpgsql security definer set search_path = ''
as $function$
declare v_normalized text := upper(trim(coalesce(p_code,'')));
  v_course uuid; v_title text;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='student') then
    raise exception 'Only student accounts may self-enroll';
  end if;
  if length(v_normalized) < 8 or length(v_normalized) > 60 then raise exception 'Invalid subject enrollment code'; end if;
  select c.id,c.title into v_course,v_title
  from public.subject_join_codes k join public.courses c on c.id=k.course_id
  where k.code_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_normalized,'UTF8')),'hex')
    and k.is_open and c.published;
  if not found then raise exception 'Invalid or closed subject enrollment code'; end if;
  if exists(select 1 from public.enrollments e where e.course_id=v_course and e.user_id=auth.uid()) then
    raise exception 'You have already joined this subject';
  end if;
  insert into public.enrollments(user_id,course_id) values(auth.uid(),v_course);
  return query select v_course,v_title;
end;
$function$;

create or replace function public.remove_student_from_section(p_student uuid,p_section uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_student is null or p_section is null then raise exception 'Student and section are required'; end if;
  delete from public.section_enrollments
  where user_id=p_student and section_id=p_section;
  if not found then raise exception 'Student is not assigned to this section'; end if;
  -- Keep public.enrollments and historical submissions/grades intact.
end;
$function$;

create or replace function public.assign_student_section(p_student uuid,p_section uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_course uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  select s.course_id into v_course from public.class_sections s where s.id=p_section;
  if v_course is null then raise exception 'Section not found'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_student and p.role='student') then
    raise exception 'Student account not found';
  end if;
  if not exists(select 1 from public.enrollments e where e.user_id=p_student and e.course_id=v_course) then
    raise exception 'Student must join the subject before being assigned to its section';
  end if;
  insert into public.section_enrollments(user_id,course_id,section_id)
  values(p_student,v_course,p_section)
  on conflict (user_id,course_id) do update
  set section_id=excluded.section_id,joined_at=now();
end;
$function$;

revoke all on function public.create_subject(text,text,text,text) from public,anon;
revoke all on function public.rotate_subject_code(uuid) from public,anon;
revoke all on function public.set_subject_join_open(uuid,boolean) from public,anon;
revoke all on function public.subject_code_status() from public,anon;
revoke all on function public.join_subject(text) from public,anon;
revoke all on function public.remove_student_from_section(uuid,uuid) from public,anon;
revoke all on function public.assign_student_section(uuid,uuid) from public,anon;
grant execute on function public.create_subject(text,text,text,text) to authenticated;
grant execute on function public.rotate_subject_code(uuid) to authenticated;
grant execute on function public.set_subject_join_open(uuid,boolean) to authenticated;
grant execute on function public.subject_code_status() to authenticated;
grant execute on function public.join_subject(text) to authenticated;
grant execute on function public.remove_student_from_section(uuid,uuid) to authenticated;
grant execute on function public.assign_student_section(uuid,uuid) to authenticated;
