# LabMate review harness (B)

Original open source review pipeline: `runReview(input, deps, opts)` in `runReview.ts`.

validate (Zod, strict) -> deterministic emergency / out-of-scope routes (zero model calls) -> retrieve <= 5 approved passages (5 s) -> Grok strict JSON (18 s, one bounded retry inside a 25 s budget) -> lenient parse -> clip lengths, drop unknown citation IDs, downgrade unsupported `source_backed` -> language policy (no approval / success %) -> state precedence -> server-derived `speechText` -> final contract validation.

## Files
- `lib/contracts.ts` — schema 1.0, contract C001 (proposed): request, source, retrieval, response, errors, transcribe/speech/health/vision bodies, provider seams (`RetrieveFn`, `GenerateFn`, `TranscribeFn`, `SynthesizeFn`), voice component props.
- `lib/harness/policy.ts` — system policy, emergency/out-of-scope cues, fixed copy, language policy, state precedence, speech text.
- `lib/harness/modelSchema.ts` — model-owned fields and the JSON schema sent to Grok.
- `lib/harness/http.ts` — transport: body limit 16 KiB, 400/413/415/422/429/502/503/504, in-memory rate limit (5/min, 2 concurrent; single process only), fixture mode, health.
- `lib/providers/grok.ts` — xAI Responses API adapter (`XAI_API_KEY`, `XAI_MODEL`).
- `app/api/review/route.ts`, `app/api/health/route.ts` — thin Next.js route handlers.
- `data/fixtures/` — requests (water/sugar, emergency, out-of-scope) and two contract-valid responses.
- `tests/harness.test.ts` — Vitest suite (contracts, policy, harness, transport).

## Run
```sh
npm test            # Vitest from the common scaffold
npm run check       # typecheck + tests + production build
```

## Integration notes for D
- No extra dependencies: uses the scaffold's pinned `zod` 4.6.7 and Vitest. Route imports use relative paths and import JSON fixtures, so keep `resolveJsonModule: true` (Next default).
- Live retrieval: pass C's `RetrieveFn` into `liveDependencies(retrieve)` in `handleReviewPost`; until merged, live reviews run with no sources and a visible warning.
- `APP_MODE` defaults to `fixture`; set `APP_MODE=live` explicitly after the Grok smoke test.
- Review success responses carry `X-LabMate-Mode: fixture|live` (`MODE_HEADER`), matching D's voice routes.
- Voice props in `contracts.ts` mirror D's tested candidate (`onConfirm`, `speechText: string`, `mode`).
