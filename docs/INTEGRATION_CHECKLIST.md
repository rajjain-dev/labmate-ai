# Integration and release checklist

Owner: D. Fill actual commits and results. This file is a checklist, not evidence of tests already passing.

## Before merging a slice

- Owner posted READY with code commit, accepted contract revision, actual checks and known limits.
- Offered branch contains that code; subsequent code changes have fresh readiness evidence.
- Diff respects ownership and contains no secrets, unannounced dependencies or schema changes.
- Affected contract proposals have explicit ACKs and D's decision record.

## After each merge

- Record source commit and resulting main commit.
- Run typecheck and affected tests on main.
- Run the journey that crosses the changed module boundaries.
- Post MERGED with results, or INTEGRATION_FAILURE assigned to the owning agent.
- Owners update from main before their next integration candidate.

## Final candidate

- Production build, policy tests, contract tests and integration tests pass on the same commit.
- Typed input reaches real review route and produces a valid result.
- Source link opens the applicable excerpt; no fabricated source IDs or claims.
- Missing data, conflicting sources, emergency cue, injection fixture and provider failure behave correctly.
- Transcript is editable and confirmed; spoken output matches validated review.
- Mic denial and cancellation preserve the typed flow.
- Claimed sponsor calls actually work; fallback and fixture modes are labeled.
- No secrets or unauthorized source material appear in public files or recordings.
- Deployed commit matches tested commit; browser journey works on deployed URL.
- Backup recording, public links, license and track evidence match the release.
- Human submitter verifies saved submission before the deadline.

If a merge breaks main, its owner fixes it. If time is short, D reverts that merge through normal Git history and restores the last passing candidate. Do not hide a failing check or silently switch live output to a fixture.
