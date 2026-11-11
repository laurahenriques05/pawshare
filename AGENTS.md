# PawShare — shared agent instructions

## Stack and scope

Use the existing React 19 + TypeScript + Vite + Tailwind/CSS application, Supabase Auth/Postgres/private Storage, and Vercel. Do not introduce another framework/backend, rewrite the app, or add a second NFC application. Teaching-staff approval for using a non-Python stack is a team prerequisite; do not claim it has been obtained without evidence.

Keep the UI mobile-first, compact, clear, accessible and harmonious with the green/cream design. Use restrained line icons, no decorative emojis or enormous dog photos. Show honest loading/error/empty states; never fabricate saved data, statistics or completed integrations. Lost Dog Mode is out of scope.

## Ownership and shared changes

- Laura: Feeding, stock and feeding NFC.
- Carol: Walks, GPS routes/statistics and walk NFC.
- Beni: Health and account settings.
- Maria: Family tasks, calendar, notifications and Academy.
- Proposed coordination default: Laura coordinates migration ordering and shared routes, shell, styles, environment configuration and database types. Feature owners author their migrations; coordinate with Laura and affected owners before changing shared contracts. The team may revise this assignment through review.

One agent per checkout at a time. Do not overwrite another member's uncommitted work. Keep feature logic in its feature directory; keep shared UI in components/ui, shell/routing in app and infrastructure in lib. All members need to understand the complete project.

## Run and check

Node 22.x, at least 22.12; npm. From repository root:

- `npm ci`
- Copy `.env.example` to `.env.local` only if the local file does not already exist.
- `npm run dev` (localhost address printed by Vite).
- `npm test` (isolated tests; never the hosted database).
- `npm run typecheck` and `npm run build` before requesting review.
- `npm run check:config` is an explicit read-only live connectivity check, not part of offline tests.

Run checks appropriate to the change. Do not weaken/delete tests to make checks pass. Review rejected operations as well as successful cases. Distinguish fixture screenshots, local database tests and live integration evidence.

## Git and releases

Work on a focused feature branch based on current main. Commit small changes and push the branch. Open a pull request with scope, tests and limitations. Another group member reviews before merge; an agent cannot count its own review as that member's approval. Do not merge or deploy unreviewed feature code merely because checks pass. Never force-push shared branches.

After approval and passing CI, merge into main and deploy the exact merged commit. Prefer Vercel Git integration with main as production branch; confirm that linkage rather than assuming it exists. If a manual release is necessary, deploy source from the clean, pushed main commit and record its SHA. Verify the production alias, deployment READY status and commit. Do not claim a local commit was pushed when authentication failed. See docs/collaboration.md.

## Secrets and hosted services

Only public browser configuration belongs in VITE_ variables. Supabase URL/publishable keys are intentionally public; secret/service-role keys, database passwords, session tokens and SMTP credentials are not. Keep `.env.local` ignored; never print secrets or commit them. Do not overwrite local configuration or expose private user data in screenshots/issues.

Scope service tools to this team project and prefer read-only inspection. Inspecting a service does not authorize mutations. Only change hosted schema/data when the task explicitly authorizes the specific work. Save every schema change as a versioned SQL migration in supabase/migrations; do not edit applied migrations, reset hosted databases or rerun migrations teammates already applied. Coordinate and review migrations before applying them. Tests use temporary/local databases and must not send real emails/push notifications.

Preserve RLS and private storage. Enforce permissions in SQL/RPC, not only by hiding controls. Never use user-editable profile metadata for authorization. Do not delete auth users to bypass ownership or stock-history constraints. Account deletion/sole-owner departure needs a deliberate reviewed design. Do not alter auth/security/access settings as an unrelated fix.

## Shared product rules

One dog per household. Members edit only their own activities; shared purchases/products and shared routine may be corrected by household members. Stock equals opening baseline + purchases - food served, including discarded food. Skipped meals serve nothing. Duplicate-meal warnings concern only regular meals too soon after the previous regular meal; treats remain separate. Persist mixed-food meals atomically and make retries idempotent.

Preserve private email-bound invitation codes and explicit acceptance. Join-another-family controls appear after leaving on onboarding, not while a current household is active. Last-person departure is planned, not implemented by the current transfer-only RPC.

## Calendar / notification interface agreement

One household calendar, initially month view, with task, food-restocking and Health filters; each item opens its source feature. Store instants consistently and present household-local times. These are agreed product requirements, not claims of an implemented shared calendar schema.

Cross-feature source records need a stable source ID, household ID, source module/record ID, title, event time, reminder time, optional assignee and source route. Maria owns the final shared API/schema; agree it with producers before implementation. Upsert by stable source ID and cancel/update obsolete reminders when source records change. Do not create duplicate feature-specific calendar/notification systems.

The existing Feeding proposal is `foodRestockingEvents` in src/features/feeding/integrations.ts. Its ID is `food-restock:<product UUID>`; occursAt and remindAt already represent the buy-by instant, and estimatedRunOutAt is separate. Do not subtract the reminder lead twice. Expected use zero means no forecast event. Recompute persistently/server-side for background reminders, not only while a page is open.

Phone push is intended. Defaults: tasks 1 hour before, appointments 1 day before, food 7 days before projected depletion; medication at dose time. Assigned tasks notify the assignee, then other members after 1 hour overdue. Medication tracks scheduled/given/skipped/overdue with a 1-hour overdue escalation. Confirm any unresolved recipient/recurrence details with the owner before building them. Respect preferences and prevent duplicate delivery. Push/calendar persistence are not implemented by Feeding.

## NFC interface agreement

Two household tags: Feeding and Start Walk. Tags store public HTTPS routes plus household identifier, never credentials. Membership/auth checks remain mandatory. Feeding opens a prefilled confirmation; opening/tapping a URL must not record food. Current Feeding URL: `<VITE_APP_URL>/feed?quick=1&household=<UUID>`. Preserve planned foods/amounts, source attribution and atomic stock deduction. If sign-in loses intent, current fallback is tapping again; do not claim automatic recovery.

Walks should start immediately after required authentication, membership and location consent, with duplicate-start protection. Carol owns the future walk route; agree it before writing tags. GPS route is shared after the walk, not live location. Warn after 10 minutes stationary, allow Keep walking, and end after 2 more minutes unanswered; background/iPhone reliability requires real-device validation.

Use Web NFC writing only when the browser supports it (compatible Android Chrome). iPhone browsers cannot write tags: an optional trusted writing app can configure the URL once; everyday tapping opens PawShare without that writer. Do not promise browser NFC support or background GPS that devices have not demonstrated.

## Handoff

Update README and relevant docs when workflows/status change. Report exactly what changed, checks run, remaining limits, migration status, remote branch/PR and deployment state. Keep unfinished capabilities distinct from implemented and verified ones.
