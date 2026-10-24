# Integrated build status

Owner: D. The common application scaffold is published on main. There is no assembled student review journey or deployment yet.

- Updated time and timezone: October 24, 2026, 12:38 PM America/New_York (16:38 UTC)
- Shared remote: https://github.com/rajjain-dev/labmate-ai
- Integrated application commit: `419b1c948d91fc6b2274dfcfbaf8768136f20e22` (common scaffold only; later status-only commits do not add application features)
- Last passing release commit: none; scaffold checks are not the product release gates
- Accepted contract revision: PENDING; C001 has no B proposal or required owner acknowledgments yet
- Wire schema target: 1.0; executable contracts/fixtures pending B
- Merged source commits: D scaffold `a391f17`, integrated with the existing handoff update as `419b1c9`; A/B/C application slices not yet offered as READY
- Working journeys and actual modes: scaffold home page only; fixture is the default configuration; voice/vision disabled; review/health/retrieval not integrated
- Commands and actual results on integrated scaffold `419b1c9`: `npm run typecheck` PASS; `npm run build` PASS using Node 24.22.1; GitHub CI also passed. No application tests existed on that baseline; no policy or live provider journey was verified
- Failing checks and responsible owner: no failing scaffold checks; product integration gates remain unmet, with A owning UI, B contracts/review/policy, C evidence/retrieval and D voice/assembly
- D voice candidate: code `df33e29` on `feat/voice-integration`, [draft PR #1](https://github.com/rajjain-dev/labmate-ai/pull/1); NOT merged into main
- Candidate verification, separate from integrated main: `npm run check` PASS (typecheck, 38 integration/component tests, production build, standalone packaging); production HTTP smoke PASS (home/static assets, MP4 fixture transcription, MP3 fixture announcement, cross-origin rejection, no packaged local environment files)
- Live candidate evidence on `af72364` (same application code as `df33e29`): real production `/api/transcribe` returned 200 live using `scribe_v2` on synthetic MP4 with expected words and confirmation required (938 ms); `/api/speech` returned 200 live MP3 using `eleven_multilingual_v2` (1285 ms). The key and verified model/voice settings remain only in D's ignored local config. Evidence is recorded on the D branch, not an integrated release
- Candidate limits: C001 pending; A has not mounted controls; actual browser microphone/correction/review/readback unverified. Live voice is gated to a supervised single process and remains disabled on public/serverless deployments pending a distributed limiter
- Deployment URL and deployed commit: none
- Sponsor qualification: no tracks verified; partial live ElevenLabs route evidence exists, with the assembled browser journey pending; private repository, source permissions and open-source license still require release work
- Freeze and submission: not frozen; not submitted
- Next actions: B publishes executable C001 proposal/fixtures and obtains A/B/C/D acknowledgments; A/B/C merge latest main into their isolated role branches and publish factual status; D aligns interfaces, integrates only agreed tested slices and verifies the actual browser voice journey

D has published kickoff, scaffold merge, voice seam, READY, contract-blocker and live-provider verification events on `feat/voice-integration`. As of the latest fetch at 12:37 PM New York time, remote A/B/C records were still NOT_STARTED and stale; no acknowledgments have been received. Git events are available when those sessions fetch; they do not wake idle agents. The human should relay the outstanding C001 request to teammate B.
