# FCPC Learning Hub v4 — Browser-Only Installation and Upgrade

**You do not need npm, Git commands, VS Code or a terminal on your own computer.** You *do* need free Supabase, GitHub and Vercel accounts and to paste the supplied SQL in Supabase's web editor. Vercel's servers automatically run the build.

## A. Upgrade an existing v3 LMS to v4

1. Back up all important grades and uploads. Test the SQL migration on a non-production Supabase project first if possible.
2. Open your existing project at [Supabase](https://supabase.com/dashboard) → **SQL Editor** → New query.
3. On your computer, extract the v4 ZIP. Open `supabase/upgrade_v4.sql` in Notepad, copy the **whole file** into the SQL Editor, and click **Run once**.
4. If it reports an error, **stop**; do not use a half-migrated database. Record the error and resolve it before deploying the new frontend.
5. In your **private** GitHub repository, update the existing project files with the v4 files. The repository root must contain `package.json`, `src`, `public`, `supabase`, etc. Use **Add file → Upload files** or edit individual files through GitHub's website. You do not need Git CLI.
6. Check Vercel → **Deployments** and confirm the updated GitHub commit builds and deploys. Keep your original `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables.
7. Log in as admin. Test **Advanced analytics**, **Attendance**, **Discussions**, **Instructors**, **Roster import**, and **Exports**. Verify a test student only sees their own section and records.
8. On a phone, use the browser's **Add to Home Screen** / **Install** menu. For production safety, the PWA does not store private materials offline.

If currently on v2, run `upgrade_v3.sql` then `upgrade_v4.sql`; if on v1, run v2 then v3 then v4. **Do not re-run `schema.sql` on an existing database.**

## B. New installation (no prior database)

1. Create a free project at [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor → New query**. Copy everything in `supabase/schema.sql` and click **Run once**. The fresh schema includes all four versions.
3. Under **Authentication → Providers → Email**, enable email/password registration and disable email confirmation if you want instant signups. This does **not** confirm that a user really owns their email.
4. Open **Authentication → Users**. If manual account creation is available, create **your own** admin user with the exact internal email `admin@fcpc-lms.local`, using a unique, strong password (do **not** keep the example `fcpcadmin` for a public website). Choose auto-confirm if offered.
5. After checking that this admin user was created by you and not by somebody else, use the SQL Editor to run:

   ```sql
   update public.profiles
   set role='admin', full_name='Course Administrator'
   where id=(select id from auth.users where email='admin@fcpc-lms.local')
   returning id, full_name, role;
   ```

   Verify exactly one row shows `admin`. If your Supabase dashboard cannot create authentication users manually, the browser-only setup cannot automatically substitute a safe admin provisioning method. Do not invent rows in `auth.users` or promote an unknown account.
6. Create a **private GitHub repository** at [GitHub](https://github.com) and upload the extracted LMS project's *contents* through the website. `package.json` must be at the root, not nested inside an extra folder. Do not upload `.env.local`, passwords or secret/service-role keys.
7. Visit [Vercel](https://vercel.com) → **Add New → Project**, import the GitHub repository, choose Next.js, and leave its default build settings.
8. Configure **Environment Variables** in Vercel:

   | Name | Supabase dashboard value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key (not secret key) |

9. Click **Deploy**, then update **Supabase Authentication → URL Configuration → Site URL** with the deployed HTTPS `*.vercel.app` URL.
10. Open the site, choose **Administrator**, log in with username `admin` and your configured password, and create subject sections. Registration and enrollment use student-created accounts and enrollment codes.

## C. Using the v4 features

- **Attendance:** Admin marks a date for a section. A promoted instructor can mark dates only for assigned sections. A student only sees personal attendance.
- **Discussions:** Select a section; students may post text topics/replies; staff can lock/delete discussions when appropriate. No rich HTML or file attachments.
- **Instructor accounts:** The person must create a normal user account first. Admin opens **Instructors** → chooses the user → **Promote** → selects a section → **Assign**. Existing student course enrollments prevent promotion; use a separate staff account or safely unenroll first. An instructor manages only assigned sections, not all courses.
- **CSV roster import:** Prepare a CSV with one header `student_number` and 1–150 existing, registered student numbers per batch. Open **Roster import** → choose section → upload CSV → **Preview matching accounts** → verify displayed names against an official roster → check confirmation → click **Confirm and enroll**. Unrecognized/duplicate numbers are not enrolled. This is not a way to create user passwords or accounts.
- **Badges:** Students open **Learning badges** to see milestone cards computed from published lessons and completed quizzes.
- **Analytics:** Admins and section-assigned instructors can see aggregate question correctness, section averages and completion. No automated cheating accusations.
- **PWA:** The LMS works with an internet connection, even when installed on a phone. No offline quiz taking, background synchronization or cached private grades.
- **Exports:** Admin-only JSON/CSV files support manual reporting. They are not a complete restorable database backup. Protect exported student data.

## D. Free-tier reality and troubleshooting

- **Vercel Hobby currently allows personal/non-commercial use only.** Official school operation may not qualify, even for unpaid courses. Check the terms yourself before deploying institutionally.
- Supabase Free includes limited file storage, database space, bandwidth, and active projects; free projects can pause. Keep lesson files small. The starter loads up to 1,000 rows per table; exports and analytics may be incomplete beyond that limit.
- The initial deployment depends on cloud services and may fail due to service quotas or build errors. This package's full build and database integration have **not** been independently verified.
- If migration fails: verify v3 was already installed before attempting v4; do not rerun the fresh-install schema.
- If an instructor sees no class: admin must assign that account at least one section.
- If roster matching fails: check that the student already registered and the number matches their profile exactly; avoid duplicate numbers.
- If install button is absent: use your browser's Add to Home Screen or Install menu; iOS often does not surface the install event.
- Use `TESTING_CHECKLIST.md` before real assessments or student data collection.
