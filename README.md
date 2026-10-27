# FCPC Learning Hub v4

A two-subject Learning Management System for **Fundamentals of AI** and **Living in the IT Era** built with Next.js and Supabase. Free-tier oriented, browser-deployable, no command-line steps required on the instructor's computer. This is an **unverified source-code release**, not a hosted service.

## What's included

| Area | Capabilities |
|---|---|
| Original student portal | Self-registration with email/password (Supabase email confirmation optionally disabled), private section enrollment codes, PDF/PPTX lesson viewer, assignments, timed quizzes, grade progress, announcements |
| Original admin portal | Lesson, assessment and section management; grading, anti-cheating event review and performance reports |
| v3 | Calendar, advanced randomized quizzes, in-app notifications, rubrics and assignment revision support |
| v4 analytics | Grade distribution, section comparisons, lesson completion, aggregate quiz question difficulty; ungraded work is not silently marked zero |
| v4 mobile PWA | Installable mobile/desktop app, responsive navigation, offline information screen, safe static-asset caching only |
| v4 attendance | Present/late/absent/excused tracking per student, section and class date; student sees own attendance |
| v4 discussions | Section-specific text threads and replies; teachers can lock and moderate |
| v4 roster import | CSV import of **already registered** student numbers, matching-name preview and required administrator confirmation |
| v4 badges | Motivational, derived badges for lesson progress and first graded quiz (not certificates) |
| v4 instructors | Assign pre-existing accounts as instructors; access limited to assigned sections; may see section analytics, attendance, discussions, and grade assigned students' assignments/essays |
| v4 exports | Locally downloaded teaching-record JSON and attendance CSV, with limitations spelled out in the UI |

### Limits that matter

- **v4 instructor accounts cannot create course-wide lessons or quizzes**: content publishing stays admin-only because both subjects' materials are currently shared across sections. Instructors can assess work, mark attendance and moderate discussions only in sections they're assigned.
- The exported JSON is a **reporting snapshot**, not a restorable database backup. It omits storage files, Supabase Auth, private answer keys and some private submission content. For full recovery, use a supported PostgreSQL backup process.
- Student account identity **is not verified** without email confirmation; self-entered student numbers are not proof of identity. Compare names against an official roster before bulk import or official grading.
- Learning badges are recalculated from published-lesson completion; students can mark lessons complete. They do **not** certify mastery.
- A browser exam cannot prevent second devices, collaborators, screen photography or identity sharing. Tab switching and copy/paste events alone are **not proof of cheating** and should never trigger automatic sanctions.
- The service worker caches only public app assets and an offline page. **Private lessons, quiz answers, grades, submissions and user pages are never cached for offline use.** Work needs internet connectivity.
- Free Supabase quotas are finite (currently 500 MB database and 1 GB storage), inactive free projects can pause, and dashboard lists load at most 1,000 rows per table. Large schools need pagination, monitoring and a long-term backup strategy. There is no usage-based paid API or required credit card in the app itself.
- **Vercel Hobby permits only personal or non-commercial use.** An official school deployment may not comply with Hobby restrictions; confirm provider terms and institutional policies before using the LMS for real classes. "No expenses" cannot be guaranteed for arbitrary scale or institutional compliance.

## Database setup

**Fresh database:** Run `supabase/schema.sql` exactly once in the Supabase web SQL Editor. It includes v1 + v2 + v3 + v4 in sequence. Do **not** then run the individual upgrade scripts.

**Existing project:** Back up the database first. Run *only the migrations you have not run already*, in order:

- v3 → v4: `supabase/upgrade_v4.sql`
- v2 → v4: `supabase/upgrade_v3.sql`, then `supabase/upgrade_v4.sql`
- v1 → v4: `supabase/upgrade_v2.sql`, then `supabase/upgrade_v3.sql`, then `supabase/upgrade_v4.sql`

Run each upgrade **once** on your existing Supabase project; never re-run the entire `schema.sql` on it. Database migrations were not executed against a live project here, so stage and verify before production use.

See **[`NO_CLI_SETUP.md`](NO_CLI_SETUP.md)** for the full browser-only deployment steps and **[`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md)** for role and security acceptance testing.

## Staff roles and security

- **Admin:** manages all courses/sections, lessons, quizzes, instructor assignments, attendance, discussion moderation and exporting.
- **Instructor:** created by promoting an already registered user, then explicitly assigning one or more sections. May access assigned students' work, their own sections, mark attendance and publish grades through database-authorized RPCs. Not equivalent to admin.
- **Student:** may only view enrolled sections, own grades/attendance and associated discussions. No access to protected quiz answer keys.
- New v4 data uses Row Level Security (RLS). Sensitive writes use security-definer functions that validate permissions. **Never put a Supabase service-role key in client code or Vercel's `NEXT_PUBLIC_` variables.**
- For simplicity, existing lesson and quiz creation remains admin-only; classroom staff can coordinate shared content through the administrator.

## Build and testing status

The v4 TypeScript/TSX files were parsed by the TypeScript transpiler; project structure and ZIP are checked. A dependency install and complete Next.js build **could not be run** because the npm registry was inaccessible from this environment. **SQL migrations and RLS have not been tested against a live Supabase project.** Before deploying to student users, run the full `TESTING_CHECKLIST.md` in a test environment and confirm the Vercel build succeeds.

## Main source files

- `src/components/LMS.tsx` — primary student/admin portals.
- `src/components/V3.tsx` — calendar, quiz, notifications and rubrics.
- `src/components/V4.tsx` — attendance, discussions, advanced analytics, badges, roster import, instructor workspace, exports and install view.
- `src/components/ServiceWorker.tsx`, `public/sw.js`, `public/manifest.webmanifest` — minimal privacy-aware PWA.
- `src/lib/performance.ts` — proportional provisional grades and safe CSV export.
- `supabase/upgrade_v4.sql` — v4 database upgrade and security controls.
