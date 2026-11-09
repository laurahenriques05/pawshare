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

Fill `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_APP_URL=http://localhost:5173
```

The first two values are in the Supabase project's Connect/API configuration. Use the publishable key (or legacy anon key), never a service-role/secret key. All VITE_ variables are visible in the browser. Do not commit `.env.local`.

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
