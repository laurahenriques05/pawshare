# Team collaboration and release procedure

## Daily workflow

1. Fetch origin and start a focused branch from current main. Never discard local work to switch branches.
2. Agree shared schema/routes/styles/contracts with Laura and affected owners before editing them.
3. Implement one reviewable slice. Run `npm test` and `npm run build`; document manual checks and limits.
4. Commit and push the feature branch. In GitHub Desktop, use Push origin while that branch is selected.
5. Open a pull request targeting main. Use the repository PR template. Ask a different group member to review; add their GitHub handle as reviewer once known.
6. The reviewer checks the diff, intended behaviour, rejected actions, tests, migration and scope. Resolve feedback. Check the Verify workflow passes.
7. After another member approves, merge into main. Do not bypass review because an agent or author says it works.
8. Pull the merged main locally. Deploy that exact commit, then record the production deployment ID/SHA and smoke-test the live URL.

## Release configuration

Production project: `pawshare`, Vercel team project ID `prj_4tp8vt9Qb3J8KgFWI9Vn5qxVEpL5`. Public URL: https://pawshare-laurahenriques05.vercel.app.

Preferred setup: connect the GitHub repository to this Vercel project and set Production Branch to main. Verify this in Vercel Settings → Git. Do not assume direct deployments establish a Git connection. Keep feature pushes as previews; preserve existing access protection and environment values. Do not copy secrets into workflow files.

For a manual release, use a clean checkout of the pushed, reviewed main commit, run checks and deploy that exact source through Vercel with its real SHA. Never deploy a different local feature tree while labelling it main. Confirm the deployment is READY and its production alias serves the expected version.

GitHub Actions already runs `npm ci`, `npm test`, and `npm run build`. The team should configure a main-branch rule requiring one other member's approval and successful Verify checks where the GitHub plan supports it. This document does not create or prove that protection. Do not request additional access or change branch protection without the repository owner's authorization.

## Current alignment handoff (11 November 2026)

The published Feeding source before this documentation update is commit `c6449b205f878ce13fd8bc5a271cfba19526dcfa`, deployment `dpl_Cj3oFD5A1A51HeB7NWtxtxbdPmne`. It was deployed directly from feature/laura-feeding. GitHub main still needs the reviewed Feeding pull request, including these documentation updates. This is a historical snapshot, not a statement that alignment is complete.

The alignment PR should include all Feeding commits since main, the latest visual polish, updated README/verification, AGENTS.md and this workflow. A different group member must review it before merge. Once merged, deploy the resulting main SHA and replace this pending handoff with a dated release entry containing PR, merge SHA, deployment ID and smoke-test result. Do not undo/reapply database migrations that are already installed.

## Shared migration ownership

Feature owners propose append-only migrations; Laura is the proposed coordinator for order, dependencies and shared types. Review SQL and test locally before any shared-database application. Tell colleagues which migrations are already applied. If two branches change related schemas, resolve the combined migration behaviour before merge, not just text conflicts.

## Review checklist

- Does the change fulfil its request without unrelated edits or fabricated data?
- Are validation, membership and creator/owner restrictions enforced server-side?
- Are existing tests preserved and appropriate checks passing?
- Are migrations reproducible and shared integration contracts coordinated?
- Are mobile/keyboard/error states usable?
- Do README and handoff match the final behaviour and its verified limits?
- Are secrets absent and production data untouched except as explicitly authorized?

## Feeding recovery integration (11 November 2026)

`codex/restore-feeding` merges `origin/feature/laura-feeding` (24ab559) into
current main (aa47e4a), preserving the Feeding source and migrations alongside
Walks. The integration repairs duplicate Home preview entries and duplicate
shared RPC type declarations from the automatic merge. Both features have active
navigation and Home summaries. No hosted data or migrations were reapplied.

Local validation: 111 tests passed, typecheck and production build passed; the
authenticated local `/feed` screen loaded the hosted household data successfully,
and Home displayed both Feeding and Walks. Production has not been updated by
this recovery branch. Another group member must review the PR before merge and
deployment of the resulting main commit.
