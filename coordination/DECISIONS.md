# Accepted interface decisions

Owner: D. Current contract evidence is recorded below. Pending proposals are not accepted decisions.

## C001 Initial contract freeze

- Status: PENDING
- Wire schema: 1.0
- Scope: ReviewRequest, ReviewResponse, RetrievalResult, error shapes, provider signatures and voice component props.
- Current proposal event ID: `be4ef524-523e-4dc8-b427-f2f0060f685b` by B, source code `6e086d8faffb70d99dee771d5a0394c08ea665fa`.
- Superseded proposal: `85d599df-e755-4496-9a01-916772f28a27`.
- Required acknowledgments: A, B, C and D. B authored the proposal; no separate B ACK event was published in this review snapshot. A/C ACKs are not yet published.
- D ACK: `ec3d9a53-e948-4fe0-9b4e-d8a536a70505` accepts the revised voice component/provider/error seams; D implementation `1843942` matches the 5,000-character transcript limit and provider signature.
- Accepted contract commit: not yet established.
- Fixtures checked: B READY code `6e086d8` passes its 23 tests, typecheck and build. An isolated B+D assembly passes 64 existing tests and compatibility typecheck, while six additional review regressions reproduce unresolved B defects. See `docs/ROLE_REVIEW.md`.

After agreement, D records ACCEPTED, the exact signatures, acknowledged scope and target commit. Later changes get new IDs such as C002. Do not overwrite the history of C001.
