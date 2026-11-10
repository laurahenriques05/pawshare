# PawShare · Milestone 1

A private, mobile-first dog-care space. Real Supabase authentication and persistence; no mock accounts or simulated data.

## Requirements

Node.js 22.12+ and npm. A Supabase project. Docker is optional and only needed for the local Supabase stack.

## Run with hosted Supabase

From this project directory:

```bash
npm ci
cp .env.example .env.local
```

The checked-in `.env.example` already contains the shared project's verified public browser settings. After copying it, check the connection:

```bash
npm run check:config
```

Expect **Connection OK**. Restart `npm run dev` after changing `.env.local`; Vite reads these values at startup. If the checker succeeds but the browser still reports Invalid API key, stop the old dev server with Control+C and start it again. Check that the browser is opening the port printed by that server.

These settings use a publishable key, which is safe to include in a browser app. Never substitute a secret or service-role key. Do not commit `.env.local`. For a different Supabase project, replace the URL and publishable key together.

**Teammates joining the existing shared project should stop here and run `npm run dev`. The database migrations below are only for provisioning a new database. Do not reapply them to our shared project.**

In Supabase SQL Editor, run the complete contents of `supabase/migrations/202611070001_initial_schema.sql` once. It creates the schema, profile trigger, transactional household RPC, grants, and RLS policies. No feature seed data is needed in this milestone. Alternatively, use the CLI after linking your project:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`supabase init` creates local CLI configuration; it does not create a hosted project. Commit its config when adopting the CLI workflow. Review migrations before pushing to a shared project.

In Authentication settings:

- Enable email/password and email confirmation.
- Set Site URL to `http://localhost:5173`.
- Add `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` to allowed Redirect URLs.
- Keep standard Supabase email templates using `{{ .ConfirmationURL }}`.
- Configure custom SMTP for testing with arbitrary real users. The built-in sender is restricted.
- Require a password of at least 8 characters. Stronger server password policies are supported; their errors display in the form.

```bash
npm run dev
```

Open http://localhost:5173. Restart Vite after changing environment values. Without configuration the app displays setup instructions instead of fake data.

## Optional local Supabase

With Docker running:

```bash
npx supabase init
npx supabase start
npx supabase db reset
```

Use the local API URL and anon key printed by the CLI in `.env.local`. Enable email confirmations in `supabase/config.toml` if testing that branch; local emails appear in the local mail inbox printed by `supabase start`. `db reset` replaces local database data. Do not run a remote reset.

## Verification

```bash
npm test
npm run build
npm run preview
```

Tests include dog validation and the actual migration executed in embedded PostgreSQL (PGlite), using a minimal auth schema and real authenticated/anonymous database roles. They cover idempotency, household isolation, forbidden writes, member permissions, and one-dog uniqueness. This does not replace a hosted Supabase/Auth integration test. If using local Supabase, additionally run:

```bash
npx supabase test db
```

The pgTAP tests are under `supabase/tests/database`. The handwritten initial TypeScript database contract is in `src/lib/supabase/database.types.ts`; regenerate after applying schema changes:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Complete manual onboarding test

1. Open `/sign-up`, enter your name, email, and a password of at least 8 characters.
2. Submit. With email confirmation enabled, check your inbox and open the confirmation link. It returns to `/auth/callback`, then onboarding. If the link has expired, sign up again to request confirmation or use Supabase's resend tools.
3. Enter a household name and valid IANA time zone (the browser suggests yours). Continue. This atomically creates the household and your owner membership.
4. Refresh before adding a dog. The app resumes the dog step; it does not create another household.
5. Enter your dog's name. Other details are optional. Save to reach the dashboard; no invitations are required.
6. Confirm your own dog and household appear. More → Dog profile lets you edit details; save, refresh, and verify persistence.
7. Sign out under More. A direct visit to `/` returns to sign-in. Sign in and verify the dashboard returns.
8. In a separate private browser session register a second account and create a different household/dog. Neither account should see the other's data. Also run the database tests, which exercise direct access beyond route guards.
9. Test a bad password, offline submission, invalid time zone, future birth date, and negative weight. Expect an actionable error without progress being fabricated.
10. Use Forgot password, open the email reset link, choose a new password, sign out, and sign in with it.
11. Check at 375px and desktop widths, keyboard-only navigation, visible focus states, and labeled inputs.

## Implemented scope

React 19, TypeScript, Vite, Tailwind 4; responsive shell and shared UI; email signup/login/confirmation return/password recovery; private household onboarding; one dog registration/editing; real dashboard/profile summary; role and account display; sign-out; error/loading/empty states; SQL migration, security tests, CI.

Feed, Walks, and Academy are explicitly disabled navigation labels. No feeding, GPS, Academy, Lost Dog, invitations, tasks, photo uploads, goals, or medical calculations are implemented. No public deployment or Supabase project provisioning has been performed.

## Architecture and security

`src/features` owns auth, household, onboarding, dashboard, and dog profile. `src/components/ui` contains shared presentation. `src/app` owns routing and shell. `src/lib` owns client, types, and validation.

Users are stored in Supabase `auth.users`; `profiles` holds private display metadata. All application tables have RLS. Household and member creation is available only through the transactional `create_household` RPC. It serializes per-user retries and resumes existing membership. Direct member insertion, role changes, deletions, and dog household reassignment are not granted to browsers. Dog creation requires an owner; legitimate members may edit dog details. Membership helpers use a private schema, fixed search path, and explicit execute grants. Account/ownership deletion is deferred until a safe owner-transfer flow exists.

The basic provider can select among existing memberships, but additional household creation/invitations are deliberately outside this milestone. Initial contracts are hand-maintained until connected schema generation is available.

## Hosting later

Deploy `dist/` after `npm run build`, with an SPA fallback to `index.html` for all non-file routes. Set the three public environment variables at build time and add the deployed callback/reset URLs in Supabase. `public/_redirects` supports compatible static hosts; `vercel.json` supports Vercel. Hosting is not provisioned by this milestone.

## Dog profile photos

Apply `supabase/migrations/202611090001_dog_photos.sql` after the initial schema. It creates a **private** `dog-photos` Storage bucket and household-restricted policies. Never make the bucket public. No additional environment variables are needed.

In More → Dog profile, choose **Upload or change photo**. JPG, PNG, and WebP inputs up to 10 MB are accepted. The browser downsizes and re-encodes the image to JPEG, removing embedded location metadata. Photos save immediately; other profile fields still use Save changes. The photo appears beside the dog's name on Home and remains after reload. Existing households need no data backfill; dogs without photos show a paw icon.

Images use a deterministic `<household-id>/<dog-id>.jpg` path, so no schema column or permanent public URL is required. Reads use five-minute signed URLs renewed while mounted. Members cannot read, upload, or replace another household's images.

Manual checks after applying the migration: upload an image, return Home, reload, replace it, cancel the picker, try a file over 10 MB, and confirm another account cannot access the object. Embedded PostgreSQL tests exercise the storage policies against a minimal Storage schema; live Storage upload/signing still requires verification against the connected project.

## Family invitations

Apply `supabase/migrations/202611090002_family_invitations.sql` after the existing migrations. The live project has this migration applied. No email delivery provider or new environment variables are needed for link-based invitations.

**Owner:** More → Family → enter the recipient's email → Create invitation link → Copy link. Share it yourself by message or email. PawShare does not send invitation emails automatically. Links expire after seven days. Revoke an unused invitation from the list; generating a replacement for the same email invalidates the previous link.

**Recipient:** open the link, sign in or register with the invited email, confirm your email if needed, then explicitly accept. New users join the existing household directly, without creating another household or dog. Existing users retain their households and can switch using the household selector at the top. The selection persists on that browser per user.

Signup and confirmation keep a pending invitation in browser storage. If confirmation is opened on a different device/browser (or storage is disabled), reopen the original invitation link after confirming your email. There is no automatic acceptance, and a link cannot be used with a different or unverified account. Back to PawShare on the invitation page clears pending navigation.

Owners see invitation status and may revoke pending links. Members see family display names and roles, but not the invitation list or other members' email addresses. Owner transfer, member removal, and automated invitation email delivery are outside this change.

Security: 240+ bits of random token entropy, SHA-256 digests at rest, owner-only issuance/revocation, confirmed email checked in `auth.users`, RLS on invitations, explicit function grants, row locking for atomic acceptance, idempotent retries, and fixed member role. Raw tokens are returned only once when creating links. Invitation routes have noindex/nofollow and the app uses a no-referrer policy.

Manual integration checks: invite an existing user, invite a new user, test an incorrect email account, confirm a new account, accept twice, revoke a link before use, generate a replacement, and verify both members see the same dog/photo. Verify the member has no invite or revoke controls and cannot use those RPCs directly.

## Rename a family

Owners can open More → Family and tap the small pencil beside the family name. A compact editor appears with Save and Cancel; Escape also cancels. The saved name updates the active header, Home privacy text, More card, family page and household selector immediately. Other members see the stored name when they next load the household. Names are trimmed and must contain 1–80 characters. Existing invitations remain valid and display the current name. Members cannot rename the family; the original owner-only household UPDATE policy enforces this on the server. No additional migration or configuration is needed.

## Home design polish

Home now presents a compact private dog portrait beside the dog’s name, a real household-member summary, an owner-only Invite someone shortcut, and the dog's saved details. The family summary uses the existing authorized roster RPC, with loading, empty, error and retry states. Owners and members see the appropriate family action. Missing profile fields are labeled clearly. No care logs or statistics are invented. The responsive layout was visually checked at desktop and 390px mobile widths using local preview fixtures; screenshots are design previews with sample content, not live account data. No new database migration is needed.

Home also contains five explicitly labeled Coming soon previews: Feeding, Walks, Academy, Family tasks, and Lost Dog. They describe future highlights without simulated data, progress, or inactive action buttons. Each preview can be replaced independently by its live feature summary. Existing family membership and invitations remain available in the real family card.
