# Role review regression reproductions

D review against B READY code `6e086d8`. Use an isolated checkout of that commit with Node 24 and `npm ci`. Save the following code as `tests/integration/d-review-audit.test.ts`, then run `npm test -- tests/integration/d-review-audit.test.ts`. All six desired-behavior assertions currently fail. The original 23 B tests pass separately. These reproductions call local functions with mocked/synthetic data and make no paid provider calls.

These intentionally failing review tests are kept as documentation until B repairs the owned modules; they are not included in the passing D CI suite.

```ts
import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { _resetRateLimit, handleHealth, handleReviewPost, readConfig } from "@/lib/harness/http";
import { normalizeModelReview } from "@/lib/harness/runReview";
import { applyLanguagePolicy } from "@/lib/harness/policy";
import request from "@/data/fixtures/request-water-sugar.json";

beforeEach(() => _resetRateLimit());
const fixture = { config: readConfig({ APP_MODE: "fixture" }) };
const post = (headers: Record<string, string> = {}) => new Request("http://localhost/api/review", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ ...request, clientRequestId: randomUUID() }),
});

it("rejects cross-origin simple requests before processing a review", async () => {
  const response = await handleReviewPost(post({ Origin: "https://other.example", "Content-Type": "text/plain; note=application/json" }), fixture);
  expect(response.status).toBe(403);
});

it("cannot bypass the demo rate cap by rotating a supplied forwarded IP", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await handleReviewPost(post({ "X-Forwarded-For": `198.51.100.${i + 1}` }), fixture)).status);
  expect(statuses.at(-1)).toBe(429);
});

it("cancels an oversized stream instead of buffering it to EOF", async () => {
  let chunks = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { if (chunks++ < 10) controller.enqueue(new Uint8Array(8192)); else controller.close(); },
    cancel() { cancelled = true; },
  });
  const response = await handleReviewPost(new Request("http://localhost/api/review", {
    method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half",
  } as RequestInit), fixture);
  expect(response.status).toBe(413);
  expect(cancelled).toBe(true);
});

it("does not retain an unsupported safety instruction as a factual imperative", () => {
  const review = normalizeModelReview({
    state: "review_available", summary: "Review your existing plan with a TA.", missingInformation: [], questionsForTA: [], limits: [],
    findings: [{ category: "safety", severity: "caution", title: "Required setup", explanation: "You must use the specified special protective equipment.", nextStep: "Use the specified special protective equipment before proceeding.", evidence: "source_backed", sourceIds: ["nonexistent"] }],
  }, []);
  expect(review.state).toBe("supervisor_review_required");
  expect(review.findings[0].explanation).not.toContain("You must use");
});

it("preserves a scientific concentration while filtering outcome estimates", () => {
  expect(applyLanguagePolicy("Confirm the stated 5% concentration with your TA.").text).toContain("5%");
});

it("does not advertise live voice with all provider settings and gates missing", async () => {
  const response = handleHealth({ APP_MODE: "live", ENABLE_VOICE: "true" });
  expect((await response.json()).capabilities.voice).toBe(false);
});
```
