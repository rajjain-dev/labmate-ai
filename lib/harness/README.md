# LabMate review harness (B)

Original open source review pipeline: `runReview(input, deps, opts)` in `runReview.ts`.

validate (Zod, strict) -> deterministic emergency / out-of-scope routes (zero model calls) -> retrieve <= 5 approved passages (5 s) -> Grok strict JSON (18 s, one bounded retry inside a 25 s budget) -> lenient parse -> clip lengths, drop unknown citation IDs, downgrade unsupported `source_backed`, rewrite unsourced safety findings as fixed uncertainty + supervisor question -> language policy (no approval / outcome or confidence %; scientific quantities such as `5% concentration` are kept) -> state precedence -> server-derived `speechText` -> final contract validation.

## Files
- `lib/contracts.ts` — schema 1.0, contract C001 (proposed): request, source, retrieval, response, errors, transcribe/speech/health/vision bodies, provider seams (`RetrieveFn`, `GenerateFn`, `TranscribeFn`, `SynthesizeFn`), voice component props.
- `lib/harness/policy.ts` — system policy, emergency/out-of-scope cues, fixed copy, language policy, state precedence, speech text.
- `lib/harness/modelSchema.ts` — model-owned fields and the JSON schema sent to Grok.
- `lib/harness/http.ts` — transport: same-origin check (403; `APP_ORIGIN` pins it), exact `application/json` media type, 16 KiB body limit enforced while streaming (cancelled past the limit; 5 s read deadline; one 25 s deadline covers transport + review), 400/413/415/422/429/502/503/504, in-memory rate limit (single process only, see below), live-review gate and provider-call cap, fixture mode, health.
- `lib/providers/grok.ts` — xAI Responses API adapter (`XAI_API_KEY`, `XAI_MODEL`).
- `app/api/review/route.ts`, `app/api/health/route.ts` — thin Next.js route handlers.
- `data/fixtures/` — requests (water/sugar, emergency, out-of-scope) and two contract-valid responses.
- `tests/harness.test.ts` — Vitest suite: contracts, policy, harness, transport, plus the handoff section 15 safety and negative cases (unspecified inputs, empty/invalid/conflicting retrieval, oversized and HTML model output, injection, cancellation, same-origin).
- `skills/labmate-review/` — reusable Agent Skill (MIT). `scripts/review.mjs` posts to a running app's `/api/review`, so it uses this same harness; it holds no policy. Tested in `tests/skill.test.ts`; validated with the `agentskills` reference validator.

## Run
```sh
npm test            # Vitest from the common scaffold
npm run check       # typecheck + tests + production build
npm run dev         # then, in another terminal:
node skills/labmate-review/scripts/review.mjs data/fixtures/request-water-sugar.json
```

## Integration notes for D
- No extra dependencies: uses the scaffold's pinned `zod` 4.6.7 and Vitest. Route imports use relative paths and import JSON fixtures, so keep `resolveJsonModule: true` (Next default).
- Live retrieval: pass C's `RetrieveFn` into `liveDependencies(retrieve)` in `handleReviewPost`; until merged, live reviews run with no sources and a visible warning.
- `APP_MODE` defaults to `fixture`; set `APP_MODE=live` explicitly after the Grok smoke test.
- Live review is supervised-demo only (handoff "Public abuse controls": the limiter is in memory). It needs `APP_MODE=live`, `REVIEW_SUPERVISED_DEMO=true` and `REVIEW_MAX_PROVIDER_CALLS` (1-200, per-process hard cap on Grok attempts; restart resets it), plus `XAI_API_KEY`/`XAI_MODEL`. Without the gate, emergency/out-of-scope still return fixed copy and other reviews get 503 before any model call. Keep public/serverless deployments on fixtures until a shared limiter exists.
- Rate limit: 5/min and 2 concurrent per client, plus 20/min and 4 concurrent per process. X-Forwarded-For / X-Real-IP are never trusted on their own. Set `CLIENT_IP_HEADER` to a header the deployment's own proxy overwrites with the client IP (verify the header name on the chosen host); it is used only as a truncated SHA-256 key. Unset, all callers share the one process budget.
- Health `capabilities.review` is `live` only with credentials and the gate; `capabilities.voice` mirrors D's `voiceMode()` gates (`ENABLE_VOICE`, `APP_MODE`, `VOICE_SUPERVISED_DEMO`, `VOICE_MAX_PROVIDER_CALLS` 1-100, all four `ELEVENLABS_*` settings). Health reports configuration only, never provider reachability.
- Review success responses carry `X-LabMate-Mode: fixture|live` (`MODE_HEADER`), matching D's voice routes.
- Voice props in `contracts.ts` mirror D's tested candidate (`onConfirm`, `speechText: string`, `mode`).
