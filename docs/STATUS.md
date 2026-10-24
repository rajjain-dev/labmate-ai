# Integrated MVP status

Owner: D. Updated October 24, 2026. Exact release code commit is recorded in coordination/status/D.json.

- Current experience: upload a selectable-text lab PDF, start voice, hear the overview and exact handout precaution quotes, then ask ongoing questions. Voice is primary; typing is optional. No app checkboxes, grading, or transcript-confirmation gate.
- Voice character: the human chose the first cheerier preview, saved as the custom ElevenLabs voice “LabMate - Bright Companion,” replacing the earlier subdued voice. The selected bright, playful, neutral-sounding voice is configured locally for all briefings and answers; its fixed greeting was regenerated.
- Human authority: D may complete other roles, skip test suites, remove confirmation, and implement the uploaded-handout conversation. C002 records this direction without fabricated peer ACKs.
- Production compilation: npm run build PASS, including TypeScript, standalone package and PDF worker. Final release evidence is recorded with the code commit.
- Targeted packaged PDF diagnostic: HTTP 200; synthetic one-page handout, 297 extracted characters, 156 ms. Initial worker handoff failure was repaired: byte buffers now travel inside an object, preserving them through Turbopack's worker wrapper.
- Live Grok briefing: HTTP 200, 1060 ms; three precaution quotes, all verified against page 1 of the synthetic handout. Follow-up answer and ElevenLabs audio evidence are recorded in D's release status.
- Browser: PDF chooser/upload observed working, conversation control enabled, optional typed question exercised. Actual human microphone capture, pause detection, and continuous spoken conversation still need the user's trial. Server diagnostics do not substitute for that evidence.
- Tests: suites SKIPPED at the human's request. Legacy confirmation/component and old rate-limit assertions are now historical and need updating before opting CI suites back in.
- Local app: http://127.0.0.1:3107. No public host is claimed. Public/serverless live use needs shared limits; current operation is a supervised single process with bounded concurrency, rate limits and provider-attempt caps.
- Data: no credentials, private handouts, private audio or student messages are committed. The PDF is not saved by the app; handout text and recent turns are sent to xAI, audio/text for speech to ElevenLabs. No provider retention promise is made.
- Bounds: 5-MiB PDF, 25 pages, 24,000 extracted characters; 29-second / 5-MiB utterances; 20 voice calls/minute and two concurrent, plus configured hard per-process paid-attempt caps. Voice ends on leaving the foreground. Talking over playback does not interrupt it; End conversation does.
- Preserved: fixed emergency escalation, handout source page inspection, bounded private routes, source-based precaution quotes and no experimental approval.
- Remaining release work: human microphone trial, instructor applicability review, public hosting controls, root license/public-release decision and demo/submission materials. Snowflake and camera remain excluded.
