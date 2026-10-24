# LabMate AI

An undergraduate teaching-lab preparation coach: share your current thinking, explore one question with a reasoning hint, add your reflection, and continue. Open source excerpts and prepare questions for your TA. Includes consented voice transcription and summary readback. It never approves an experiment.

## Run locally

Use Node 24 from .nvmrc. Run npm ci, copy .env.example to .env.local if needed, then npm run dev. The default fixture mode is visibly labeled. For the standalone production app run npm run build, then supply runtime environment variables and npm start (or node --env-file=.env.local .next/standalone/server.js).

Live operation needs xAI and ElevenLabs server-only credentials plus the supervised flags and per-process attempt caps documented in docs/MVP.md. Never commit .env.local or use NEXT_PUBLIC_ for keys. Public/serverless live operation requires a distributed limiter.

## Current scope

Live Grok review, an editable student form, inspectable local NIST passages, fixed emergency guidance, clarification loop, recording/confirmation and speech controls. The local sources provide general experimental-design context, not a course protocol or SDS. Snowflake and camera are excluded from the fast MVP.

The human explicitly requested skipping tests for this delivery. Production build/TypeScript compilation passed, and a live review returned a valid response with three sources. No claim is made that the changed MVP passed the test suites. See docs/STATUS.md and docs/MVP.md for exact commits, actual evidence and remaining release work.

The shared remote is https://github.com/rajjain-dev/labmate-ai. Development coordination records and ownership history remain in coordination/. B's original backend and later repair contributions are preserved; D completed missing roles under the human's delivery instruction.
