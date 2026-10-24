# Role contribution review

Reviewer: D. Snapshot: October 24, 2026, approximately 1:05 PM America/New_York. This review uses fetched remote branches, exact READY code, independent checks, and an isolated B+D integration checkout. Unpublished local work on teammates' computers is outside this review.

## Published work and verification

| Role | Fetched branch / code | Verified contribution | Remaining work |
| --- | --- | --- | --- |
| A | `feat/student-ui` at `6f92ed0` | Starter only; no published UI changes, status still NOT_STARTED | Push current work/status; acknowledge revised C001; form, review/results/error states, citation viewer, clarification, confirmed voice mounting, browser tests and demo recording |
| B | `feat/review-harness` at `75756a5`; READY code `6e086d8` | Executable schemas, fixtures, deterministic policy, injectable review harness, Grok adapter, review/health routes. Independent `npm run check` PASS: 23 tests, typecheck, production build | Repair findings below; live Grok/model verification; wire C's retrieval; reusable review skill; fresh READY and evidence |
| C | `feat/evidence` at `6f92ed0` | Starter only; no published corpus/adapter changes, status still NOT_STARTED | Push current work/status; acknowledge C001; approved local passages with provenance/license manifest; retrieval adapter/tests; Snowflake setup/live evidence if pursuing that track |
| D | `feat/voice-integration`; compatibility fix `1843942` | Scaffold on main; bounded voice routes and consented controls; prior live STT/TTS route checks; 41 tests/typecheck/build PASS after aligning the C001 transcript limit and provider signature | Contract freeze after remaining ACKs; integrate repaired owners' slices; actual browser microphone/edit/review/readback; deployment; release and submission evidence |

Main still contains the scaffold, not these assembled application modules. A and C's starter-only remote branches do not prove no work exists locally; their owners must publish it for review/integration.

## B findings requiring repair

All six cases reproduced against READY code `6e086d8`. The complete desired-behavior regression tests are in [ROLE_REVIEW_REPRO.md](ROLE_REVIEW_REPRO.md). All six currently fail; the 23 existing B tests pass. These are separate results.

### R1 — P1: unsupported safety instructions survive citation removal

In `lib/harness/runReview.ts:152-160`, a fabricated citation is removed and `evidence` changes to `unknown`, but the explanation and next step remain factual instructions. A model finding saying “You must use the specified special protective equipment” with an unknown source ID survives unchanged in the returned finding. Supervisor state alone does not satisfy the requirement to turn unsupported safety requirements into uncertainty or a supervisor question. Reject the finding/output or replace the unsupported instruction with fixed uncertainty/question copy; do not preserve an imperative solely with an evidence label. Owner: B.

### R2 — P1: cross-origin requests can reach the review handler

`lib/harness/http.ts:122-123` checks whether Content-Type contains `application/json`, and the handler never validates Origin. A request from `https://other.example` with `Content-Type: text/plain; note=application/json` returns 200 rather than 403. That media type can be sent as a simple browser request, so the JSON substring test also defeats the intended content-type boundary. Compare the parsed media type exactly and apply the same-origin check before processing/paid work. Owner: B.

### R3 — P1: the review rate cap trusts caller-supplied identities

`lib/harness/http.ts:73-75` keys the only limiter directly from X-Forwarded-For/X-Real-IP. Six requests with different supplied X-Forwarded-For values all return 200, bypassing the stated five-per-minute cap in a direct Node deployment. This also creates indefinitely retained map entries. Live review has no enforced supervised/public deployment gate despite having only an in-memory limiter. Use a trusted deployment identity or a coarse process-wide demo budget and explicit supervised gating; keep public/serverless live calls off until a shared limiter exists. Owner: B, with D coordinating deployment settings.

### R4 — P1: the upload limit applies after buffering the whole body

`lib/harness/http.ts:133-134` calls `req.text()` before checking actual bytes. An oversized chunked stream is consumed to EOF, never cancelled at 16 KiB, then returns 413. The 25-second harness budget also starts only after the transport finishes reading, so slow uploads can retain the two allowed slots. Bound streamed reads and include transport in the deadline/cancellation budget. D's bounded voice-body helper illustrates the needed behavior. Owner: B.

### R5 — P2: the outcome filter removes scientific concentrations

`lib/harness/policy.ts:100` makes the outcome words optional, so it replaces any percentage. “Confirm the stated 5% concentration with your TA” becomes “Confirm the stated [no outcome estimate]concentration…”. Preserve scientific quantities and restrict this rule to actual outcome/confidence assertions. Owner: B.

### R6 — P2: health advertises live voice without its required settings

`lib/harness/http.ts:169` reports `capabilities.voice=true` from ENABLE_VOICE alone. With APP_MODE=live and all voice models/key/supervised gates absent, health says voice is available while D's routes return 503. Derive capability from the same actual configuration gates used by the voice runtime; health still must not imply that configuration proves provider reachability. Owner: B, with D supplying the gating rules in docs/VOICE_INTEGRATION.md.

## D compatibility fixes completed

- B's revised C001 caps a transcript at 5,000 characters; D previously accepted 6,000. D now rejects provider/client transcripts above 5,000, with boundary and client regression tests.
- B's `TranscribeFn` accepts validated bytes and MIME; D previously required an additional `duration` property in the function signature. The adapter now matches B's signature. Duration/container validation remains mandatory in the HTTP route before the adapter is called.
- A compiler assignment check initially failed for `TranscribeFn`, then passed after D's fix. Component props and synthesis types also matched.
- In isolated, unpublished review merge `0bf0303` (B `6e086d8` + D `1843942`), typecheck including the extra seam assertion, all 64 existing tests, production build and standalone packaging passed. This checkout was not merged into main. The six new B regressions remain unresolved.

## Contract and release gates

B's current proposal is `be4ef524-523e-4dc8-b427-f2f0060f685b`, superseding the initial proposal. D explicitly ACKed its voice/error/provider seams in event `ec3d9a53-e948-4fe0-9b4e-d8a536a70505`. A/C acknowledgments are not published in this snapshot, so C001 stays PENDING. Passing the compilation checks is not an acknowledgment by another owner.

Next priorities:

1. A and C publish their actual branches/status; A/C explicitly ACK the current contract. B repairs the reproducible review findings and offers a new tested commit. D records acceptance only after the required agreement.
2. Assemble the typed fixture journey across A's page and B's real route; preserve fixture labels and deterministic emergency behavior. Add C's approved local evidence and inspect every displayed citation.
3. B verifies an account-supported Grok model with local server-only credentials and sanitized evidence. C verifies Snowflake if available; otherwise label approved local retrieval accurately and drop the unsupported track claim.
4. Test an actual browser recording, editable confirmation, fresh review and latest-summary readback. Existing synthetic MP4/live HTTP evidence is useful but does not prove this user journey. Streaming WebM without readable duration remains a known browser compatibility limit.
5. Choose/configure deployment, run release checks and browser negative cases on the exact deployed main commit, confirm no secrets are included, and capture a backup demo. Complete license/README/source permissions and B's reusable skill if claiming the open-source track. Prepare truthful sponsor evidence and submission links with the handoff's submission buffer.

Coordination events published by D: review failures to B (`86afe962-ebc5-448f-891c-1d830bb22d3e`), publication/ACK request to A/C (`f3c3816e-9907-4631-907d-dc9992ec2ac6`), and D's current contract ACK above. Git records do not wake idle agents; the human should relay urgent actions to the teammates.
