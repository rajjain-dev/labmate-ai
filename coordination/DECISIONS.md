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

## MVP delivery direction from the human

The human explicitly requested finishing the MVP faster, said D may need to complete the other roles, and then requested skipping tests. D is completing missing UI/evidence and necessary backend repairs in one isolated assembly using B's unchanged C001 wire contracts. This is direct human authorization for the expanded implementation scope and test-suite omission; it is not a claim that A/C sent ACKs. Original peer status and proposal history remain intact. The complete assembled commit will be recorded after compilation, with the actual test omission disclosed.

## C002 Conversational voice direction from the human

The human explicitly requested removing all app consent checkboxes and transcript confirmation, then clarified the desired flow: upload a selectable-text lab PDF, hear a brief and the handout's precautions, and ask ongoing spoken questions with typing optional. This supersedes C001's transcript-confirmation product behavior under direct human authority; peer ACKs are not claimed.

- Voice starts from one explicit Start conversation action, plays the brief, detects spoken turns and pauses, submits automatically, reads answers, and listens again until ended. Browser microphone permission remains controlled by the browser. Quiet turns stay local; each captured utterance is bounded to 29 seconds and 5 MiB. Leaving the foreground ends the session. Audio cannot be interrupted by speaking while LabMate is talking; End conversation remains available.
- Transcription returns requiresConfirmation=false. Review inputMode adds voice (without claiming human confirmation); voice_confirmed remains for compatibility. The existing review activity bound increases to 5,000 characters, matching transcription. The primary conversation routes use their own strict schemas.
- /api/lab accepts one PDF, up to 5 MiB / 25 pages / 24,000 extracted characters. It extracts text in a memory-limited worker with an 8-second timeout; the PDF is not saved by the application.
- /api/conversation receives the current handout, current question and up to 12 recent turns. Briefing precautions must be exact quotes found on the cited handout page; unmatched quotes are removed. PDF text and history are treated as data, not agent instructions. No claim is made that the handout covers every hazard.
- The supervised single-process voice rate limit becomes 20 calls/minute (two concurrent), supporting speech recognition and speech playback across a conversation. Provider hard attempt caps, model budget, origin checks, fixed emergency policy and local-only default are retained. Public live operation still requires shared controls.
- Tests remain skipped at the human's request. Production compilation and actual targeted live requests are recorded in D's status; no browser microphone end-to-end pass is inferred from server requests.

## C003 Sable frontend direction from the human

The human requested the exported `sable-source` Lovable frontend and the existing voice agent inside Sable’s button. D integrated the supplied visual design and manual controls into the existing Next.js application, keeping the C002 document/conversation/transcription/speech routes and server bounds. The voice component supports an optional custom controls renderer; page changes keep the voice session and log mounted. This follows direct human direction, without claiming peer acknowledgments. The integration record is in `docs/SABLE_INTEGRATION.md`. Sable is previewed on port 3108 so separate LabMate frontend work can continue on port 3107.

The human then selected Sable as the current direction, requested larger controls/text and a one-screen landing with Upload higher up, and explicitly requested automatic speech after the first upload: safety notes and warnings, then key points, then conversational questions. The upload gesture prepares audio playback; browser microphone permission is requested after the spoken opening. Missing precautions are announced by the client, which also shows safety before key points. API schemas and source validation are unchanged. This is direct human authority, without fabricated peer acknowledgments.

## C004 Web research requested by the human

The human explicitly requested internet-based precautions and other information beyond the uploaded PDF. D is implementing this expanded scope under the existing direction to complete missing roles. This is direct human authority; no A/B/C ACK is inferred.

- Sable opts into `/api/conversation` research with optional `webResearch: true`. Requests omitting it retain the original response shape. Opted-in responses add `webSources` (up to three title/URL/exact-quote/kind/ID records), `webCitations` (validated source IDs) and `researchStatus` (`used`, `unavailable`, `no_sources`, `disabled`, `not_needed`). Client defaults also accept old responses.
- An opt-in server flag, `ENABLE_WEB_RESEARCH`, enables xAI native web search using the configured credentials/model. Search sees fixed public experiment topic labels, never uploaded passages, filenames or raw student questions/history. The ordinary answer call still receives the handout and conversation as disclosed.
- Search is restricted to ACS, CDC, OSHA, PubChem and RSC domains. Returned HTTPS URLs must have appeared in the provider's search/citation output, then be fetched independently from those domains with bounded redirects, bodies and deadlines. Each displayed excerpt must occur in the fetched page and stay within 25 words per source page. This validates provenance, not applicability to every lab condition.
- PDF safety quotes retain exact page validation. Web excerpts have separate labels and links, are read before opening key points, and never acquire fabricated handout page references. Course procedure and the TA remain authoritative. Failed or unverified web lookup is explicitly labeled and falls back to the handout. Fixed emergency/scope routing occurs before external research.
- Web lookup and answer each consume a shared model attempt. Native tool use can incur additional charges; search is bounded to two agent turns with parallel tool calls disabled, not claimed as a strict two-individual-tool-call cap. Public topic/source caches last ten minutes (20 entries). Research has an 18-second deadline within the 35-second conversation deadline. Tests remain skipped at the human's request; build and targeted live/browser evidence are recorded separately.
