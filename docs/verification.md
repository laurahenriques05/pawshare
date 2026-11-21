# Verification evidence and limits

Updated 21 November 2026. Test counts are observations, not permanent guarantees.
Use Node 22.x >=22.12; npm test, npm run typecheck, npm run build and git diff
--check. Tests must not call the hosted database or send real emails/push.

## Latest checks — Walks Back/NFC alignment

On `codex/walks-back-and-nfc-alignment` (base main `f942ad8`), all
**299 isolated tests in 68 files**
passed on Node 22.23.5 with both Supabase browser values blank.
TypeScript, production build and git diff --check also passed. Changed Markdown file links were checked.
Existing node_modules were reused; this is not a fresh npm ci. The care-task
fixture now picks a future time within the current UTC day: the former +1 hour
failed after 23:00 because starting a future-day walk is correctly forbidden.
Assertions and production task rules are unchanged.

Existing Zod annotation and large-bundle advisories remain; they are not failed
checks. PGlite/minimal Auth/Storage roles cover isolation, rejected writes, retries,
stock, routines, GPS/timeline and deletion. This is not a hosted security audit.

Current real-component fixtures at 1280px/360px checked ← Back and centred NFC
step titles/descriptions. Text-container centres matched the rectangle centres
at both widths, with no horizontal page overflow at 360px. No NFC tags were
written and no hosted database requests were made; fixtures were removed. This
branch only changes labels/styles, retaining the existing tested deletion/GPS
contracts and their pending hosted/device validation.
These checks are not physical tags, live account persistence or actual GPS.

## Read-only hosted evidence — 20 November

Migration ledger confirms installed Walks core/waste/tracking/deleted-owner-preview,
journal/preferences, pause/duration and correction capabilities; exact mapping is
in walks.md. Tasks reliability/quick assignment and Tasks/Push/Academy schema are
also recorded. Manual Health SQL may not be represented in that ledger.

Function inspection confirms hosted set_walk_deleted remains author-only and
set_walk_routine preserves order but permits optional/partial estimates. Proposed
family-deletion and strict-hour/stable-ID follow-ups are not applied. The consolidated family-removal migration is also proposed only. A read-only
21 November function check confirms author-only soft deletion and no permanent
RPC; no live write was used to test this. No hosted care
records or schema were changed by this follow-up.

GitHub reports Vercel success for merged #68. Current Vercel team access is denied;
exact production alias/READY/commit must be verified separately, not invented.

## Still requires explicit integration/device evidence

- Hosted auth/email/recovery, every invitation/onboarding/departure/deletion path.
- Disposable multi-account writes and forbidden actions on the exact deployed UI.
- Android/iPhone physical NFC write/tap/sign-in and permission/duplicate behaviour.
- Outdoor GPS, pause/resume, stationary 2+5, lost signal, offline/reload/reconnect,
  screen lock and app switching. Follow walks-gps-testing.md; no background promise.
- Google key/billing/domain/runtime paths and external provider availability.
- Push sender secrets/deployment/cron, recurring materialization and iOS/Android
  delivery; database queue/schema and calendar links do not establish delivery.
- Health Storage cleanup and Auth deletion/session expiry/retry under reviewed
  server environment, without weakening Auth/RLS or deleting real user accounts.

Use designated disposable data only; record exact commit/device/environment and
observed outcomes. Keep read-only schema, fixtures, rolled-back SQL, actual writes
and physical-phone results distinct. Do not fabricate green checks for missing
observations. Release procedure is in collaboration.md.
