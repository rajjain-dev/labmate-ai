# Track evidence

Owner: D. No sponsor track is verified by this record yet. This is an implementation/evidence ledger, not an eligibility claim.

| Track | Current evidence | Remaining gate |
| --- | --- | --- |
| ElevenLabs | Live production-route transcription of synthetic MP4 and MP3 readback passed on D branch; consent/confirmation controls have deterministic tests | Assemble A/B/C modules and accepted C001; verify real browser recording/correction/review/readback and collect demo evidence |
| Grok | B's module not yet offered as READY | Live schema-valid review and trace from B; assembled UI test |
| Snowflake | C's module not yet offered as READY | Approved sources, live retrieval and supporting displayed citation from C |
| Open source harness | Common scaffold available in private repo | B's original harness/tests/skill; license and source permissions; human-authorized public release and eligibility review |

## Live evidence template

- UTC timestamp and New York local time:
- Exact code commit and deployment (if applicable):
- Provider and model, without account identifiers:
- Sanitized app request ID:
- Operation and actual fixture/live mode:
- Latency and success/failure:
- Observed user journey and limitations:
- Source of recording/consent confirmation, without raw media or private input:

Keep credentials, account IDs, raw audio, private student text, and full provider logs out of this file.

## ElevenLabs production-route smoke, October 24, 2026

Code commit: `af723648e68046f3f181741d3dfcdb4cb03f0c61`; application files are unchanged from `df33e29`, which passed typecheck, 38 tests and production build. GitHub CI also passed on `af72364`. Server: local standalone Node 24, temporary live supervised mode with a two-attempt allowance. No public deployment.

- 2026-10-24T16:36:34.791Z (12:36:34 PM America/New_York): `POST /api/transcribe` returned 200, mode `live`, model `scribe_v2`, 942 ms. App request ID: `ce30a488-ade3-4cd0-8ff8-1f4007506b7e`.
- 2026-10-24T16:36:36.077Z (12:36:36 PM America/New_York): `POST /api/speech` returned 200, mode `live`, model `eleven_multilingual_v2`, 1285 ms. App request ID: `4b507385-4d32-463d-a4ea-7eb528f22078`.

The transcription input was a synthetic local test sentence encoded as MP4; expected words were recognized and `requiresConfirmation` was true. Readback returned 67,752 bytes of MP3 using the stock George voice. Only the generated test media stays under ignored `.coord-local/voice-smoke/`; no private student content, account identifiers, API keys or raw media are committed.

A model-listing request was denied for missing `models_read` permission, while both required speech endpoints succeeded. This is partial sponsor evidence: actual browser microphone capture, correction, assembled review and playback remain unverified. No claim of a complete voice journey or track qualification is made.
