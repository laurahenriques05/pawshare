# Laura — Feeding and food stock

Branch: `feature/laura-feeding`. The `20261111113735_feeding_and_stock.sql` migration was applied to shared Supabase on 11 November 2026 after Laura authorized publication. Do not apply it a second time. No new environment variables or packages are required. Do not rerun older migrations already installed on the shared database.

## Implemented

- `/feed`, accessible from desktop/mobile navigation and a compact Home summary.
- Multiple dry-food, wet-food, and treat products; normal portion and expected daily use for each.
- Saved daily routine with named/timed mixed-food meals; duplicate warning uses the shortest planned gap, an explicit override, or meals/day fallback.
- Purchases in grams per package × package count, with date/time; opening-stock/correction baseline for already-open packages or unrecorded waste.
- Actual meal quantities and timestamp, creator attribution and NFC source.
- An atomic purchase/meal ledger; computed stock, no mutable stock counter. Retries with the same operation UUID update one record instead of deducting twice.
- Explicit extra-meal confirmation if the previous non-treat meal is inside the usual interval. Treats are separate.
- Own-meal editing/removal, shared purchase/product editing; soft deletion and immutable audit history.
- Positive stock enforcement; edits/removals that would produce negative current stock are rejected.
- Product-specific days-remaining and buy-by estimates, default seven-day restocking warning, and honest 'no estimate' for irregular consumption.
- Feeding NFC setup URL. Opens quick feeding with confirmation; it never logs on GET/tap.
- A typed proposed integration adapter for Maria. No shared calendar/notification schema was invented.

## Schema and security

`feeding_settings`, `food_products`, `feeding_entries`, `feeding_audit` all have member-scoped SELECT RLS. Browsers cannot write tables directly. Public SECURITY INVOKER wrappers delegate to guarded private transactional functions. Private functions lock the household, recheck membership after the lock, validate household/product relationships and creator rights, then commit ledger + audit atomically. Definer functions have fixed empty search paths and revoked PUBLIC/anon execute access. No service-role client is used.

Stock = opening baseline + nonremoved purchases − nonremoved feeding quantities. Editing a meal changes its original ledger row; deleting it restores stock. All members may edit purchases; only a meal creator can edit/delete that meal. Corrections are audited. Products are retained so historical records keep their meaning; archiving/deletion UI is not included. Food type cannot change once a product has ledger history, preserving regular-meal versus treat classification. Add a different product instead.

Only current balance is enforced, not a historical stock timeline. Backdated corrections can be entered. Timestamps are stored as timestamptz; entry inputs explicitly use the device's local time, while history/daily totals use household timezone. Treat logs do not count toward regular meals/day.

Profiles for departed users are not disclosed; their past logs show 'Former family member'. Audit/entry creator FKs must be considered by Beni's future account-deletion design rather than blindly cascading away stock history.

## Calendar / notifications handoff (Maria)

`foodRestockingEvents(products, entries, now)` in `src/features/feeding/integrations.ts` returns proposed source records:

- stable `id = food-restock:<product UUID>`;
- householdId, source='feeding', sourceRecordId;
- title, href='/feed', assignedTo=null;
- occursAt = buy-by instant, remindAt = same instant;
- estimatedRunOutAt = separate projected depletion instant;
- lowStock flag.

The adapter is a proposal for mapping into Maria's eventual interface, not a second calendar implementation. Upsert by stable source ID; replace/cancel the old schedule when stock/daily-use/reminder changes. Do not subtract seven days a second time: remindAt already includes the user's lead time. Unassigned restocking reminders should reach all household members with preferences respected. Recompute forecasts server-side on changes and periodically; do not rely on a page being open. Expected daily use=0 yields no event. Current stock is not silently consumed by time passing—only recorded meals reduce actual stock.

Phone push delivery and persistent calendar events are NOT implemented by this branch. In-app low-stock notices work once the migration is applied.

## NFC handoff (Carol)

Proposed feeding URL: `<VITE_APP_URL>/feed?quick=1&household=<UUID>`.
No credentials in the tag. The route requires authentication and existing membership through the app shell. A mismatched active household displays an error and blocks the quick action; the person can switch using the existing household selector. Confirmation performs the authorized RPC. If sign-in interrupts the URL, tap again after sign-in. PawShare now writes the URL itself through Web NFC on supported Android Chrome browsers, with permission, cancellation, timeout and explicit opt-in before overwriting existing data. iPhone browsers cannot write NFC tags. A trusted iPhone writing app may be used once to put the URL on a sticker; everyday use opens PawShare directly without that writing app. Native in-app iPhone writing is not implemented. Device/tag compatibility still needs real-phone testing. Carol can propose an equivalent walk URL without changing Feeding's API. No automatic feeding on URL navigation.

## Manual test after migration

1. Sign in, open Feed, add dry food with 100 g portions, 200 g/day, 0 g opening stock, seven-day warning.
2. Add a purchase: 1000 g/package × 2 packages. Stock must be 2 kg.
3. Record 100 g feeding; stock must be 1.9 kg. Reload and check history/stock persist.
4. Record another regular meal immediately: warning appears. Explicitly confirm the extra meal and check one deduction only.
5. Add treats and log some; no regular-meal warning or regular-meal count increase.
6. Correct/remove your meal and verify restored/recalculated stock.
7. A second household member can see it, edit shared purchases, but cannot edit/remove your meal even via RPC.
8. A different household cannot read/mutate any of these records. Try forged product/entry IDs and direct table writes.
9. Reduce daily stock until the forecast crosses seven days; the restock notice appears. Set expected daily use=0; no fabricated estimate.
10. Test `/feed?quick=1&household=<your household>` and actual NFC tags on supported iPhone/Android devices. Verify no record is created until confirmation and repeated submissions do not double-deduct.
11. Check daily totals in a household timezone different from the device, including near midnight.
12. Remove a purchase that would make stock negative: it must fail without partial data changes.

## Remaining refinements

Mixed-food routines and grouped meal outcomes are implemented (see below). Remaining work includes phone push integration, calendar persistence, physical NFC testing and recovery of NFC intent across sign-in. The ledger is paged in 500-record batches to avoid silent PostgREST truncation; a server snapshot/aggregate endpoint would improve large-history consistency and efficiency. Shared data refreshes manually or on window focus; the checklist clock is not a cross-device data subscription.

Verification: the migration and authorization rules were executed in embedded PostgreSQL (PGlite), with pure calculation/adapter tests. Actual React product and meal forms were visually checked using labelled sample-data previews at desktop and 390px widths; this is not a hosted browser-to-Supabase onboarding test. A live Supabase transaction under the authenticated role verified purchases, idempotent retries, deductions, duplicate warnings, edits/removal, and outsider isolation; all test data was rolled back. Phone push and physical tag verification remain pending. See the chat deployment result for publication status.

## Detailed daily routine update

The next migration `20261111123255_detailed_feeding_routine.sql` adds a shared JSON meal plan, validated on the server: 1–12 named/timed meals, up to 12 distinct household food products per meal, positive gram quantities, and optional preparation notes. The food type comes from the selected product. Saving a plan does not consume stock. Planned daily totals replace manual forecast quantities for products included in the plan; other products retain their own estimates.

Record feeding/NFC can select a planned meal and prefill every ingredient, adjust actual quantities, and save the whole meal atomically. `feeding_meal_events` groups ledger lines: a mixed-food meal counts once, each product stock is deducted once, and operation retries do not duplicate the event. History groups meal outcomes and food lines for creator-only correction/removal. Single-food/treat logging remains available.

The duplicate warning uses an optional user-selected minimum gap, or the shortest gap between scheduled meals (including overnight) if left blank. The threshold is not a nutritional calculation or a requirement to feed at an exact minute. Times use the household timezone, while actual datetime inputs identify the device-local timezone as before. No phone reminders are sent by this routine until the shared notification integration exists. Maria can read `feeding_settings.meal_plan` as the source for future meal reminders; use meal UUIDs for stable source identifiers.

## Daily checklist and feeding outcomes

Migration `20261111130122_feeding_checklist_outcomes.sql` extends grouped meal events with actual time, outcome, notes, source and a soft-delete marker, plus eaten grams per ingredient. `save_meal_result` validates membership/creator rights, serializes household writes and updates a result plus all ledger lines atomically. Given means eaten in full; partial requires positive consumption less than served; refused means served but zero eaten; skipped means no food served and no ledger deduction. Stock always tracks served food, not eaten food. Corrections replace ingredient lines transactionally and preserve audit history. Removing the whole event restores all served quantities.

The daily checklist matches the routine meal UUID and the event's household-local date; mixed ingredients never count as separate meals. It displays Upcoming/Due or the recorded outcome, actor and actual time. Due starts at the saved meal time; the screen's clock refreshes every 30 seconds. Removed results are excluded. Unmatched legacy/ad-hoc records remain in history and are not guessed into scheduled slots. The next highlight prioritizes the earliest unrecorded meal today, including due meals. If all slots have records it says so, rather than pretending an extra meal is required. Phone reminder delivery is still separate from this UI.
