# Integrated MVP status

Owner: D. Updated October 24, 2026, 1:50 PM America/New_York.

- Current application commit: 90eddf8, simple coaching and streaming browser voice correction, following MVP 6357fc3.
- Scope: working local student UI, live Grok review, clarification edits, inspectable NIST excerpts, fixed emergency guidance, integrated consented voice input and summary readback.
- Source commits: B backend/skill/repairs 3eabcbf; D voice alignment 1843942; D MVP UI/evidence 618b059; final assembly 6357fc3. A/C's original remote starter records are preserved; D completed the missing modules at the human's explicit request.
- Contract: B C001 wire schema 1.0 used unchanged. D ACK recorded; no fabricated A/C ACKs. Human explicitly authorized D to complete other roles for fast MVP delivery.
- Verification actually run: npm run build PASS on 6357fc3, including TypeScript compilation and standalone packaging. Test suites SKIPPED at the human's request; no claim they pass on the changed MVP. CI suites are opt-in via LABMATE_RUN_TESTS=true during this sprint.
- Live request on 6357fc3: HTTP 200, state needs_clarification, mode live, model grok-4.20-0309-non-reasoning, retrieval local, 3 sources and 2 findings, 7328 ms. App request ID: 17b75d8a-840d-4d57-a650-1af2e88bab85.
- Coaching: two prompts only (what you are doing, what help you need), a brief explanation and one scientific follow-up. Students can reply and continue. No grades or completeness checklist; safety escalation remains explicit.
- Voice: reproduced streaming WebM rejection (422); now packet-derived duration permits the same synthetic audio through live ElevenLabs (200, 664 ms, confirmation required). Actual human microphone capture remains for the user to exercise.
- Current revision: production build/TypeScript compilation PASS; test suites remain skipped at the human request. Live browser guidance from the two-input form was observed successfully; evidence is recorded in the coordination update.
- Local app URL: http://127.0.0.1:3107 (supervised single Node process). No public deployment URL.
- Modes and secrets: default shared config is fixture, live requires explicit supervised flags and provider attempt caps; local live keys are in ignored .env.local only. No vendor retention promise is made.
- Source pack: three short attributed NIST design excerpts, general guidance only. No course-specific protocol or SDS, no safety approval.
- Excluded to ship faster: Snowflake and camera. No claim of qualifying those tracks.
- Remaining public release work: host/shared limiter for public live access, instructor applicability review, root license/public-release decision, demo/submission materials.

See docs/MVP.md for setup, docs/TRACK_EVIDENCE.md for sanitized live evidence, and data/SOURCE_LICENSES.md for provenance. Earlier role review docs are historical snapshots; B's repair commit is integrated.
