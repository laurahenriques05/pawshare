# Walk GPS feasibility prototype

Open `/walks/gps-test` after signing in and completing household/dog onboarding.
This is a location diagnostic, not a saved walk. No coordinates are sent to
Supabase or persisted. Navigating away or refreshing stops and clears the test.
Only the last 40 diagnostic events are retained in memory.

## Phone testing

Use an approved HTTPS deployment of this branch to test on a phone.
The computer's `127.0.0.1` link cannot be used from another device; ordinary
HTTP over a LAN does not satisfy browser geolocation's secure-context requirement.
Coordinate a preview deployment with the team, including Supabase auth redirect
configuration. No deployment or database migration is needed for local development.

On iPhone/Safari and Android/Chrome, record device/browser versions and:

1. Start the test, grant location permission, and walk outside for five minutes.
2. Lock the screen for two minutes, unlock, and note position age and gaps.
3. Switch to another app for two minutes, return, and note gaps.
4. Disable internet temporarily and check whether GPS still arrives.
5. Stop the test; confirm the received position count stops increasing.
6. Reload during testing: this prototype intentionally resets. Active-walk
   recovery and offline route storage belong to the persisted-walk stage.
7. Deny permission, check the explanation, then allow it in browser settings.
8. Navigate away while tracking and verify the browser stops location use.

The gap detector flags delivery gaps above 30 seconds as diagnostic events;
this is not a stationary-detection threshold. No desktop check can establish
screen-locked phone tracking reliability. There is no auto-end or notification.

## Implementation and remaining validation

The persisted Walks feature is now implemented; see [walks.md](walks.md) for
installation, privacy rules, provisional policy decisions, integration boundaries
and the live acceptance checklist. The prototype remains diagnostic-only.

Record actual phone results here before promising background tracking:

| Device/browser | Foreground | Screen locked | Other app | Offline | Refresh after reconnect | Permission denied |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone / Safari | Pending | Pending | Pending | Pending | Pending | Pending |
| Android / Chrome | Pending | Pending | Pending | Pending | Pending | Pending |
