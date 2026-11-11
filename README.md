# PawShare

**Live website:** https://pawshare-laurahenriques05.vercel.app

**Repository:** https://github.com/laurahenriques05/pawshare

PawShare is a private, mobile-first dog-care application for a household sharing one dog. This university group project uses React 19, TypeScript, Vite, Tailwind CSS, Supabase Auth/Postgres/Storage, and Vercel.

## Team and responsibilities

| Member | Feature ownership |
| --- | --- |
| Laura | Feeding, food stock, feeding NFC; proposed integration coordinator for shared files and migration ordering |
| Carol | Walk tracking, GPS routes/statistics, walk NFC |
| Beni | Health, medication, treatment/document/weight history, vet details, account settings |
| Maria | Family tasks, shared calendar, notifications, Academy |

Feature owners implement their own UI, rules, migrations and tests. Coordinate shared changes with Laura and the affected owner before editing them. Anyone must be able to explain the whole application. See [AGENTS.md](AGENTS.md) for agent instructions and [the collaboration guide](docs/collaboration.md) for releases. Teaching-staff approval for the non-Python stack must be confirmed by the team; this repository does not establish that approval.

## Current functionality

- Email/password registration, sign-in, sign-out, confirmation return and password recovery through Supabase Auth. Email delivery depends on the project's Auth/SMTP configuration.
- Private household creation and one-dog onboarding, without needing invitations; dog profile editing and private photo upload displayed beside the dog's name on Home.
- Family roster, owner-only discreet family rename, email-bound invitation codes created by household members, invitation acceptance, and household departure. An owner must select another existing member before leaving; a sole owner cannot currently leave. After leaving, onboarding offers creating a household or joining an existing family.
- Feeding and stock: multiple dry/wet/treat products, opening stock, package purchases, stock forecasts and in-app restocking notices.
- Saved daily meal routines with explicit Edit/Save/Cancel, meal times, mixed foods/quantities and notes; today's meal checklist and quick recording; Given, Partially eaten, Refused and Skipped outcomes.
- Stock decreases by food served, including discarded portions, rather than food eaten. Own feeding corrections/removal, shared purchase/product editing, atomic writes, retry protection and audit history.
- A duplicate regular-meal warning only when another meal is recorded too soon. Treats are separate. The threshold uses the shortest planned gap, an explicit override, or the meals/day fallback.
- Feeding NFC URL and confirmed quick logging; optional in-app tag writing on compatible Android Chrome browsers.

Walks, Academy, Health and family tasks/calendar are future features represented by Coming soon previews. Phone push delivery, GPS routes, walk NFC and persistent calendar integration are not implemented here. Lost Dog Mode has been removed from scope. Current shared Feeding data refreshes on manual refresh/window focus; the clock update does not provide cross-device live synchronisation.

## Run locally with the shared database

Install **Node.js 22.12+ (22.x recommended)** and npm. Clone the repository and open its folder:

```bash
git clone https://github.com/laurahenriques05/pawshare.git
cd pawshare
npm ci
cp .env.example .env.local
npm run check:config
npm run dev
```

Open the localhost address printed by Vite (normally http://localhost:5173). If you already have the repository, fetch/pull the reviewed branch rather than cloning again. Until the Feeding pull request is reviewed and merged, use `feature/laura-feeding` for that work; `main` is the intended release branch.

The checked-in example contains the shared project's public browser settings. Required configuration:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Shared Supabase project API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Matching public publishable key; never a secret/service-role key |
| `VITE_APP_URL` | `https://pawshare-laurahenriques05.vercel.app` for shared/live links |

`.env.local` is ignored by Git. Vite embeds `VITE_` values in the browser bundle: do not put secrets in them. Restart the dev server after changing configuration. `check:config` makes a read-only request to the configured service; it is separate from the offline automated tests. An Invalid API key error usually requires checking the matching URL/key and restarting the correct dev server.

**Joining the shared project does not require running migrations. Do not reset or reapply migrations to the shared hosted database.** A developer needs a Supabase dashboard invitation only to administer the service, not to use PawShare.

## Database setup for a new, separate project

The source of truth is `supabase/migrations/`. Apply every migration once, in filename order, to a new project; the initial migration alone is insufficient. This includes profiles/households/dogs, private dog-photo storage, invitations and codes, leaving/ownership transfer, and all three Feeding migrations. See [the Feeding handoff](docs/feeding-handoff.md).

Use the Supabase SQL Editor or adopt the CLI workflow after checking its current help. Local CLI config is not currently committed: create it with `supabase init` before using the local Docker stack. Never run a remote reset. Review pending migrations against the target before applying them. Database schema and application release changes must be coordinated.

For the hosted application, configure Auth Site URL as the live website. Allow these redirects, plus local equivalents when developing:

- `https://pawshare-laurahenriques05.vercel.app/auth/callback`
- `https://pawshare-laurahenriques05.vercel.app/reset-password`
- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`

Enable email/password sign-in. If email confirmation is enabled, configure dependable SMTP before promising public registration; the default sender has restrictions. Keep standard confirmation-link templates. Never disable security settings as a workaround without explicit agreement. Record configuration changes without copying credentials into documentation.

## Invitations and household membership

In **More → Family**, enter the recipient's email, create an invitation code, and share it privately. Codes expire after seven days; replacing one for the same email invalidates the previous code. PawShare does not automatically email invitation codes. The recipient signs in with the invited email and uses **Join an existing family** on household onboarding to enter and accept the code. Email verification requirements still apply. Legacy `/invite/:token` routes remain supported.

Join-another-family controls belong on onboarding after leaving the current family, not on the active family page. Owners transfer ownership to an existing member when leaving. Sole-owner departure/deletion and full account deletion remain unfinished; do not delete auth users directly to bypass ownership/history constraints.

## Feeding and NFC

See [Feeding details and manual checks](docs/feeding-handoff.md). NFC tags contain an HTTPS URL, never credentials:

```text
https://pawshare-laurahenriques05.vercel.app/feed?quick=1&household=<household UUID>
```

The person must sign in and belong to that household. Tapping opens the confirmation flow; it never records a meal just by opening a URL. If sign-in loses the quick-action intent, tap again after signing in.

Compatible Android Chrome devices can write tags from PawShare. iPhone browsers cannot write NFC tags: use a trusted iPhone NFC-writing app once to store the URL. Everyday use opens PawShare directly without that writing app. Physical tags and device-specific behaviour still need testing. Walk tags are reserved for Carol's future implementation.

## Commands and verification

```bash
npm test                 # Isolated automated tests, including embedded PostgreSQL
npm run typecheck        # TypeScript checks
npm run build            # TypeScript + production bundle
npm run preview          # Serve the local production build
```

GitHub Actions runs install, tests and build on pushes/pull requests. On 11 November 2026, **93 tests across 11 files passed**, and the production build passed. Tests exercise validation, invitations, photo policies, household isolation, Feeding calculations, migrations, creator permissions, stock deductions and retries. This is not proof of hosted email delivery, every browser workflow, physical NFC or push delivery. See [verification evidence and limits](docs/verification.md).

The handwritten TypeScript database types include application contracts. If generating Supabase types, generate to a temporary file and reconcile changes; do not blindly overwrite custom exported types.

## Manual smoke test

1. Register/sign in on the deployed app; verify email confirmation and password recovery separately when enabled.
2. Create a household and dog without inviting anyone. Reload; confirm persistence and no duplicate household.
3. Edit the dog, upload/replace its photo, and verify Home. Try invalid input and an oversized image.
4. Invite a second account by code, accept with the matching email, and verify both see the same dog. Wrong-email/revoked/expired invitations must fail.
5. Add food, buy two packages, save a two-meal mixed-food routine and log a meal. Confirm checklist, history and stock served quantities after reload.
6. Try a too-soon meal, a refused/partial/skipped result, own corrections, another member's forbidden correction, and another household's isolation.
7. Test owner rename and departure with transfer in a disposable demo household. Verify joining another family is offered after leaving.
8. Check mobile/desktop, keyboard navigation, visible focus, offline errors and retry. Use two devices to check the actual refresh behaviour.

## Architecture and security

`src/app` owns routes/shell; `src/features` owns domain workflows; `src/components/ui` holds shared UI; `src/lib` holds clients, types and validation. Supabase `auth.users` owns credentials; `profiles` stores display metadata. Application tables have household/user-scoped RLS, and privileged transactional operations enforce membership and ownership on the server. Dog photos use private Storage and short-lived signed URLs.

## Releases

The production application is hosted by Vercel, with SPA rewrites in `vercel.json`. Set the public configuration at build time. The target workflow is **branch → push → pull request → another member's review → passing checks → merge to main → deploy that main commit**. Earlier direct releases are historical exceptions, not the future workflow. Do not claim GitHub/main/production are aligned until their actual commit IDs have been verified. See [release steps](docs/collaboration.md).
