// labmate-review skill tests (owner: B). The script must reach the same harness as the app, with no policy of its own.
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ReviewResponseSchema } from "../lib/contracts";
import { handleReviewPost, readConfig, _resetRateLimit } from "../lib/harness/http";
import { EMERGENCY_COPY } from "../lib/harness/policy";
import { EXIT, formatReview, parseArgs, plain, prepareRequest, requestReview } from "../skills/labmate-review/scripts/review.mjs";
import waterReq from "../data/fixtures/request-water-sugar.json";
import emergencyReq from "../data/fixtures/request-emergency.json";

const SCRIPT = "skills/labmate-review/scripts/review.mjs";
const viaHarness = (env: Record<string, string> = { APP_MODE: "fixture" }) => (req: Request) =>
  handleReviewPost(req, { config: readConfig(env) });

test("skill: fixture review goes through the app's review handler and is labeled fixture", async () => {
  _resetRateLimit();
  const result = await requestReview(waterReq, { fetchImpl: viaHarness() });
  assert.equal(result.status, 200);
  assert.equal(result.mode, "fixture");
  assert.ok(ReviewResponseSchema.safeParse(result.body).success);
  const text = formatReview(result);
  assert.match(text, /^LabMate review \| mode: FIXTURE \(canned example/);
  assert.match(text, /State: needs_clarification/);
});

test("skill: emergency request prints the fixed escalation copy and no findings", async () => {
  _resetRateLimit();
  const text = formatReview(await requestReview(emergencyReq, { fetchImpl: viaHarness() }));
  assert.match(text, /State: emergency/);
  assert.ok(text.includes(EMERGENCY_COPY));
  assert.match(text, /Findings:\n {2}\(none\)/);
});

test("skill: app errors are reported with code and retryable flag", async () => {
  _resetRateLimit();
  const result = await requestReview({ ...waterReq, goal: "x" }, { fetchImpl: viaHarness() });
  assert.equal(result.status, 422);
  assert.match(formatReview(result), /^LabMate error 422 VALIDATION_ERROR \(retryable: no\)/);
});

test("skill: untrusted output cannot inject terminal control sequences", () => {
  assert.equal(plain("ok\u001b[31mred\u001b[0m\u0007\u009b"), "okred");
  const text = formatReview({ status: 500, mode: null, body: { error: { code: "X\u001b[2J", message: "m\u001b]0;t\u0007", retryable: false } } });
  assert.doesNotMatch(text, /\u001b|\u0007/);
});

test("skill: arguments and request preparation", () => {
  assert.deepEqual(parseArgs(["plan.json", "--url", "https://x.example", "--json"]), { file: "plan.json", url: "https://x.example", json: true });
  assert.throws(() => parseArgs([]));
  const filled = prepareRequest(JSON.stringify({ ...waterReq, clientRequestId: undefined }));
  assert.match(String(filled.clientRequestId), /^[0-9a-f-]{36}$/);
  assert.equal(prepareRequest(JSON.stringify(waterReq)).clientRequestId, waterReq.clientRequestId);
  assert.throws(() => prepareRequest("[]"));
});

test("skill: CLI exit codes for bad input and an unreachable app", () => {
  const usage = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(usage.status, EXIT.USAGE);
  const down = spawnSync(process.execPath, [SCRIPT, "data/fixtures/request-water-sugar.json", "--url", "http://127.0.0.1:9"], { encoding: "utf8", timeout: 20_000 });
  assert.equal(down.status, EXIT.UNREACHABLE);
  assert.match(down.stderr, /Could not reach LabMate/);
});

test("skill: SKILL.md frontmatter matches the handoff and the script holds no policy", () => {
  const skill = readFileSync("skills/labmate-review/SKILL.md", "utf8");
  assert.match(skill, /^---\nname: labmate-review\n/);
  assert.match(skill, /\nlicense: MIT\n/);
  const script = readFileSync(SCRIPT, "utf8");
  assert.doesNotMatch(script, /lib\/harness\/policy|EMERGENCY_PATTERNS|applyLanguagePolicy/);
});
