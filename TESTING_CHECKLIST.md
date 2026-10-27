# FCPC Learning Hub v4 — Deployment and Security Acceptance Checklist

**Required before real coursework:** Test on a throwaway Supabase project with two sections in one subject, a separate subject, one admin, two students per section, and an instructor assigned to just one section.

## Build, login and sections

- [ ] Vercel production build finishes with no TypeScript errors; server renders on HTTPS.
- [ ] `schema.sql` works in a newly created empty Supabase project (not just the individual migration).
- [ ] v3 → v4 migration works in a backed-up test clone with existing grades, users, sections and submissions retained.
- [ ] New student registers without email confirmation when explicitly disabled in Supabase.
- [ ] Administrator has a strong password and can access the admin portal; secret keys never appear in client code.
- [ ] Student cannot promote their profile by changing API requests, editing JavaScript, or passing an arbitrary role field.
- [ ] Instructor cannot obtain admin rights or edit/unlock section enrollment codes.
- [ ] Instructor cannot join a course through `join_section` as a student.

## v4 attendance and discussions

- [ ] Admin records present/late/absent/excused, edits a marked day and sees results in admin attendance.
- [ ] Instructor can record attendance only in their assigned sections; direct RPC for another section fails.
- [ ] Student can view only own attendance; other students' rows are not selectable directly via Supabase.
- [ ] Student from Section A cannot read/write Section B discussion threads or replies, including direct API requests.
- [ ] Instructor moderates assigned section but cannot lock/delete threads in a different assigned-to-other-teacher section.
- [ ] Discussion text is rendered as text, not executable HTML; no script injection.

## v4 instructor/roster/security

- [ ] Admin promotes an existing non-enrolled user to instructor; assigning a section enables only that section's roster, work, and analytics.
- [ ] Student cannot call instructor-promotion or assignment RPCs successfully.
- [ ] Instructor cannot access another section's submissions, essays, attendance or individual student records.
- [ ] Instructor grades a permitted student's assignment and essay; invalid scores are rejected on the server.
- [ ] Instructor cannot see private quiz answer keys or the correct choices in database queries.
- [ ] CSV preview returns registered matching names and status without enrolling anyone; import requires explicit second action.
- [ ] Unknown, duplicate, already-enrolled and malformed student numbers are handled without creating new auth accounts.
- [ ] Students with self-entered IDs are verified against the official roster before enabling academic access.

## v4 analytics, badges and PWA

- [ ] Analytics shows section-level provisional grades, completion rates, distribution, and aggregate question scores.
- [ ] Admin cannot use analytics to read protected answer keys; teacher only accesses their assigned section aggregates.
- [ ] Student sees earned/locked progress badges computed for their own subjects only.
- [ ] Manifest and icons load from the deployed domain; browser provides an install flow when supported.
- [ ] Service worker caches only public static assets and offline explanation page, not sensitive HTML/grade pages, API calls, signed URLs, or private files.
- [ ] Disconnect internet and confirm quiz, grades, private lessons and submissions do not falsely claim offline sync.
- [ ] Student UI and mobile sidebar remain usable at phone widths.

## Prior LMS functionality: regression

- [ ] Lesson PPTX preview and PDF viewer work with private storage; timed scheduled lessons are not accessible early.
- [ ] Student cannot view or modify another student's grades or submission files.
- [ ] Randomized quiz questions and options vary in order but retain the same underlying answer key and score.
- [ ] Timer, submission windows, attempt limits and grades are enforced by database functions, not merely the browser.
- [ ] Essays pending instructor review are not labeled final grades.
- [ ] A focus change or tab switch alone never automatically penalizes anyone.
- [ ] CSV/JSON exports contain only appropriate fields; exported student data is stored securely.
- [ ] Dashboard loading limit (currently 1,000 rows per queried table) is understood and exports are not assumed complete above that size.
