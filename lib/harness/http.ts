/**
 * Transport layer for POST /api/review and GET /api/health (owner: B).
 * Route files stay thin and call these so the logic is testable without Next.js.
 */
import { randomUUID } from "node:crypto";
import {
  CONTRACT_REVISION,
  MODE_HEADER,
  SCHEMA_VERSION,
  ReviewRequestSchema,
  type ErrorCode,
  type ErrorResponse,
  type HealthResponse,
  type ReviewDependencies,
  type ReviewResponse,
} from "../contracts";
import { HarnessError, runReview, policyResponse } from "./runReview";
import { POLICY_VERSION, detectEmergency, detectOutOfScope } from "./policy";
import { createGrokGenerate } from "../providers/grok";
import waterSugarResponse from "../../data/fixtures/response-water-sugar.json";

export const MAX_BODY_BYTES = 16 * 1024;

export interface ServerConfig {
  appMode: "live" | "fixture";
  retrievalProvider: "local" | "snowflake";
  enableVoice: boolean;
  enableVision: boolean;
  corpusVersion: string;
}

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    appMode: env.APP_MODE === "live" ? "live" : "fixture", // never inferred from a missing key
    retrievalProvider: env.RETRIEVAL_PROVIDER === "snowflake" ? "snowflake" : "local",
    enableVoice: env.ENABLE_VOICE === "true",
    enableVision: env.ENABLE_VISION === "true",
    corpusVersion: env.CORPUS_VERSION || "demo-v1",
  };
}

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  UPSTREAM_INVALID: 502,
  REVIEW_UNAVAILABLE: 503,
  TIMEOUT: 504,
};
const RETRYABLE = new Set<ErrorCode>(["RATE_LIMITED", "UPSTREAM_INVALID", "REVIEW_UNAVAILABLE", "TIMEOUT"]);

const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json" };

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...NO_STORE, ...extra } });
}

export function errorResponse(code: ErrorCode, message: string, extra: Record<string, string> = {}): Response {
  const body: ErrorResponse = { requestId: randomUUID(), error: { code, message, retryable: RETRYABLE.has(code) } };
  return json(body, STATUS[code], extra);
}

// --- Rate limiting: in-memory, single-process demo only (not reliable across serverless instances).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_CONCURRENT = 2;
const hits = new Map<string, number[]>();
const inflight = new Map<string, number>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

function takeSlot(key: string, now: number): number | null {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW || (inflight.get(key) ?? 0) >= MAX_CONCURRENT) {
    const retry = arr.length ? Math.ceil((WINDOW_MS - (now - arr[0])) / 1000) : 5;
    hits.set(key, arr);
    return Math.max(1, retry);
  }
  arr.push(now);
  hits.set(key, arr);
  return null;
}
export function _resetRateLimit() {
  hits.clear();
  inflight.clear();
}

/** Build live dependencies. `retrieve` is injected by integration (C's adapter); null until merged. */
export function liveDependencies(retrieve: ReviewDependencies["retrieve"] = null): ReviewDependencies {
  return { retrieve, generate: createGrokGenerate(), clock: () => Date.now(), makeId: () => randomUUID() };
}

/** Explicit, visibly labeled fixture mode. Safety routes still apply deterministically. */
export function fixtureReview(input: unknown, cfg: ServerConfig): ReviewResponse {
  const req = ReviewRequestSchema.parse(input);
  const deps: ReviewDependencies = { retrieve: null, generate: null, clock: () => Date.now(), makeId: () => randomUUID() };
  const opts = { corpusVersion: cfg.corpusVersion };
  if (detectEmergency(req) || detectOutOfScope(req)) {
    const r = policyResponse(req, detectEmergency(req) ? "emergency" : "out_of_scope", deps, opts, Date.now());
    return { ...r, meta: { ...r.meta, mode: "fixture" } };
  }
  const base = waterSugarResponse as unknown as ReviewResponse;
  return {
    ...base,
    requestId: randomUUID(),
    clientRequestId: req.clientRequestId,
    meta: { ...base.meta, mode: "fixture", generation: "fixture", latencyMs: 0, warnings: ["Fixture mode: canned example review, not generated for this input."] },
  };
}

export async function handleReviewPost(
  req: Request,
  opts: { config?: ServerConfig; deps?: ReviewDependencies } = {},
): Promise<Response> {
  const cfg = opts.config ?? readConfig();
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return errorResponse("UNSUPPORTED_MEDIA", "Use application/json.");
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return errorResponse("PAYLOAD_TOO_LARGE", "Request body exceeds 16 KiB.");

  const key = clientKey(req);
  const retryAfter = takeSlot(key, Date.now());
  if (retryAfter !== null) return errorResponse("RATE_LIMITED", "Too many reviews; wait and retry.", { "Retry-After": String(retryAfter) });

  inflight.set(key, (inflight.get(key) ?? 0) + 1);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorResponse("PAYLOAD_TOO_LARGE", "Request body exceeds 16 KiB.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("BAD_REQUEST", "Malformed JSON.");
    }
    const check = ReviewRequestSchema.safeParse(body);
    if (!check.success) {
      return errorResponse("VALIDATION_ERROR", check.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ").slice(0, 500));
    }
    if (cfg.appMode === "fixture") return json(fixtureReview(check.data, cfg), 200, { [MODE_HEADER]: "fixture" });
    const deps = opts.deps ?? liveDependencies();
    const result = await runReview(check.data, deps, { corpusVersion: cfg.corpusVersion, signal: req.signal });
    return json(result, 200, { [MODE_HEADER]: result.meta.mode });
  } catch (e) {
    if (e instanceof HarnessError) return errorResponse(e.code, e.message);
    return errorResponse("REVIEW_UNAVAILABLE", "Review unavailable.");
  } finally {
    inflight.set(key, Math.max(0, (inflight.get(key) ?? 1) - 1));
  }
}

export function handleHealth(env: Record<string, string | undefined> = process.env): Response {
  const cfg = readConfig(env);
  const liveReady = Boolean(env.XAI_API_KEY && env.XAI_MODEL);
  const body: HealthResponse = {
    schemaVersion: SCHEMA_VERSION,
    contractRevision: CONTRACT_REVISION,
    appMode: cfg.appMode,
    policyVersion: POLICY_VERSION,
    corpusVersion: cfg.corpusVersion,
    capabilities: {
      review: cfg.appMode === "fixture" ? "fixture" : liveReady ? "live" : "unconfigured",
      retrieval: cfg.retrievalProvider,
      voice: cfg.enableVoice,
      vision: cfg.enableVision,
    },
  };
  return json(body);
}
