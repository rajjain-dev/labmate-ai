/**
 * Transport layer for POST /api/review and GET /api/health (owner: B).
 * Route files stay thin and call these so the logic is testable without Next.js.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  CONTRACT_REVISION,
  MODE_HEADER,
  SCHEMA_VERSION,
  ReviewRequestSchema,
  type ErrorCode,
  type ErrorResponse,
  type GenerateFn,
  type HealthResponse,
  type ReviewDependencies,
  type ReviewResponse,
} from "../contracts";
import { HarnessError, REVIEW_DEADLINE_MS, runReview, policyResponse } from "./runReview";
import { POLICY_VERSION, detectEmergency, detectOutOfScope } from "./policy";
import { createGrokGenerate } from "../providers/grok";
import waterSugarResponse from "../../data/fixtures/response-water-sugar.json";
import { localRetrieve, retrieveLocalPassages } from "../providers/local";

export const MAX_BODY_BYTES = 16 * 1024;
/** A 16 KiB JSON body should arrive quickly; slow uploads must not hold a review slot. */
export const BODY_READ_DEADLINE_MS = 5_000;

export interface ServerConfig {
  appMode: "live" | "fixture";
  retrievalProvider: "local" | "snowflake";
  enableVoice: boolean;
  enableVision: boolean;
  corpusVersion: string;
  /** Fixed public origin (e.g. https://labmate.example). Unset: compare against the request's Host. */
  appOrigin: string | null;
  /**
   * Header that the deployment's own proxy sets (overwrites) to the client IP, e.g. "do-connecting-ip".
   * Unset: no per-client identity is trusted and every request shares one process-wide budget.
   * X-Forwarded-For is never trusted on its own because callers can set it.
   */
  clientIpHeader: string | null;
  /**
   * Live review runs only in a supervised single-process demo (handoff section "Public abuse controls"):
   * the limiter is in memory, so public/serverless live traffic stays off until a shared limiter exists.
   */
  reviewSupervisedDemo: boolean;
  /** Per-process hard cap on model calls, 1 to 200; 0 (or invalid) keeps live review off. Restart resets it. */
  reviewMaxProviderCalls: number;
}

function intInRange(v: string | undefined, min: number, max: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : 0;
}

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    appMode: env.APP_MODE === "live" ? "live" : "fixture", // never inferred from a missing key
    retrievalProvider: env.RETRIEVAL_PROVIDER === "snowflake" ? "snowflake" : "local",
    enableVoice: env.ENABLE_VOICE === "true",
    enableVision: env.ENABLE_VISION === "true",
    corpusVersion: env.CORPUS_VERSION || "demo-v1",
    appOrigin: env.APP_ORIGIN || null,
    clientIpHeader: env.CLIENT_IP_HEADER?.trim().toLowerCase() || null,
    reviewSupervisedDemo: env.REVIEW_SUPERVISED_DEMO === "true",
    reviewMaxProviderCalls: intInRange(env.REVIEW_MAX_PROVIDER_CALLS, 1, 200),
  };
}

/** Live review gate. Credentials are checked separately (the Grok adapter throws REVIEW_UNAVAILABLE). */
export function liveReviewAllowed(cfg: ServerConfig): boolean {
  return cfg.appMode === "live" && cfg.reviewSupervisedDemo && cfg.reviewMaxProviderCalls > 0;
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

/**
 * Same-origin check (handoff section 13), matching D's voice routes. Browsers always send Origin on POST;
 * a missing Origin is a non-browser client (the labmate-review skill, curl), which is still rate limited.
 * Never trusts X-Forwarded-Host. Returns null when allowed.
 */
export function originProblem(req: Request, cfg: Pick<ServerConfig, "appOrigin">): "forbidden" | "misconfigured" | null {
  if (req.headers.get("sec-fetch-site") === "cross-site") return "forbidden";
  const origin = req.headers.get("origin");
  if (!origin) return null;
  let expected: string;
  try {
    const url = new URL(req.url);
    expected = new URL(cfg.appOrigin || `${url.protocol}//${req.headers.get("host") || url.host}`).origin;
  } catch {
    return "misconfigured";
  }
  return origin === expected ? null : "forbidden";
}

// --- Rate limiting: in-memory, single-process demo only (not reliable across serverless instances).
// Two layers: a per-client budget keyed by a short-lived hash of a deployment-trusted IP header, and a
// process-wide budget that caps total spend no matter what identities callers present.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_CONCURRENT = 2;
const GLOBAL_PER_WINDOW = 20;
const GLOBAL_CONCURRENT = 4;
const MAX_TRACKED_KEYS = 500;
export const PROCESS_KEY = "process";
const hits = new Map<string, number[]>();
const inflight = new Map<string, number>();
let globalHits: number[] = [];
let globalInflight = 0;
let providerCalls = 0;

/**
 * Rate-limit identity. Only the header named by CLIENT_IP_HEADER is used, and only as a truncated hash.
 * Without it, all callers share PROCESS_KEY, so rotating X-Forwarded-For cannot buy extra calls.
 */
export function clientKey(req: Request, cfg: Pick<ServerConfig, "clientIpHeader"> = { clientIpHeader: null }): string {
  if (!cfg.clientIpHeader) return PROCESS_KEY;
  const ip = req.headers.get(cfg.clientIpHeader)?.split(",")[0]?.trim();
  if (!ip) return PROCESS_KEY;
  return "c:" + createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function sweep(now: number) {
  for (const [k, arr] of hits) {
    if (!(inflight.get(k) ?? 0) && arr.every((t) => now - t >= WINDOW_MS)) {
      hits.delete(k);
      inflight.delete(k);
    }
  }
}

function takeSlot(key: string, now: number): number | null {
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (hits.size >= MAX_TRACKED_KEYS) sweep(now);
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const busy =
    arr.length >= MAX_PER_WINDOW ||
    (inflight.get(key) ?? 0) >= MAX_CONCURRENT ||
    globalHits.length >= GLOBAL_PER_WINDOW ||
    globalInflight >= GLOBAL_CONCURRENT ||
    (!hits.has(key) && hits.size >= MAX_TRACKED_KEYS);
  if (busy) {
    const oldest = Math.min(arr[0] ?? Infinity, globalHits.length >= GLOBAL_PER_WINDOW ? globalHits[0] : Infinity);
    return Number.isFinite(oldest) ? Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)) : 5;
  }
  arr.push(now);
  hits.set(key, arr);
  globalHits.push(now);
  return null;
}
export function _resetRateLimit() {
  hits.clear();
  inflight.clear();
  globalHits = [];
  globalInflight = 0;
  providerCalls = 0;
}

/** Wrap the model call with the per-process allowance. Counted per attempt, because each attempt is paid. */
function capProviderCalls(generate: GenerateFn, max: number): GenerateFn {
  return (input, signal) => {
    if (providerCalls >= max) throw new HarnessError("REVIEW_UNAVAILABLE", "This demo's live review allowance is exhausted. Fixture and emergency guidance remain available.");
    providerCalls++;
    return generate(input, signal);
  };
}

class BodyError extends Error {
  constructor(public code: "PAYLOAD_TOO_LARGE" | "TIMEOUT") {
    super(code);
  }
}

/** Read at most `limit` bytes; cancel the stream as soon as it exceeds the limit or the signal aborts. */
export async function readBoundedText(req: Request, limit: number, signal: AbortSignal): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw new BodyError("TIMEOUT");
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new BodyError("TIMEOUT");
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new BodyError("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof BodyError) throw e;
    throw new BodyError(signal.aborted ? "TIMEOUT" : "PAYLOAD_TOO_LARGE");
  } finally {
    signal.removeEventListener("abort", cancel);
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

/** Build live dependencies. `retrieve` is injected by integration (C's adapter); null until merged. */
export function liveDependencies(retrieve: ReviewDependencies["retrieve"] = localRetrieve): ReviewDependencies {
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
    sources: retrieveLocalPassages(req).passages,
    limits: [base.limits[0], "Canned demonstration; NIST excerpts provide experimental-design context, not a course protocol or safety approval."],
    meta: { ...base.meta, mode: "fixture", generation: "fixture", retrieval: "local", latencyMs: 0, warnings: ["Fixture mode: canned example review, not generated for this input."] },
  };
}

export async function handleReviewPost(
  req: Request,
  opts: { config?: ServerConfig; deps?: ReviewDependencies } = {},
): Promise<Response> {
  const cfg = opts.config ?? readConfig();
  // One deadline covers transport and review, so a slow upload cannot extend the 25 s budget.
  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(REVIEW_DEADLINE_MS)]);
  const origin = originProblem(req, cfg);
  if (origin === "misconfigured") return errorResponse("REVIEW_UNAVAILABLE", "The application origin is not configured.");
  if (origin === "forbidden") return errorResponse("FORBIDDEN", "Use LabMate from this application's page.");
  // Exact media type: "text/plain; note=application/json" is a browser simple request and is refused.
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return errorResponse("UNSUPPORTED_MEDIA", "Use application/json.");
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return errorResponse("PAYLOAD_TOO_LARGE", "Request body exceeds 16 KiB.");

  const key = clientKey(req, cfg);
  const retryAfter = takeSlot(key, Date.now());
  if (retryAfter !== null) return errorResponse("RATE_LIMITED", "Too many reviews; wait and retry.", { "Retry-After": String(retryAfter) });

  inflight.set(key, (inflight.get(key) ?? 0) + 1);
  globalInflight++;
  try {
    let raw: string;
    try {
      raw = await readBoundedText(req, MAX_BODY_BYTES, AbortSignal.any([deadline, AbortSignal.timeout(BODY_READ_DEADLINE_MS)]));
    } catch (e) {
      if (e instanceof BodyError && e.code === "TIMEOUT") return errorResponse("TIMEOUT", "The request body did not arrive in time.");
      return errorResponse("PAYLOAD_TOO_LARGE", "Request body exceeds 16 KiB.");
    }
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
    const base = opts.deps ?? liveDependencies();
    // Ungated live mode still answers emergency/out-of-scope deterministically, then 503 before any model call.
    const deps: ReviewDependencies = {
      ...base,
      generate: base.generate && liveReviewAllowed(cfg) ? capProviderCalls(base.generate, cfg.reviewMaxProviderCalls) : null,
    };
    const result = await runReview(check.data, deps, { corpusVersion: cfg.corpusVersion, signal: deadline });
    return json(result, 200, { [MODE_HEADER]: result.meta.mode });
  } catch (e) {
    if (e instanceof HarnessError) return errorResponse(e.code, e.message);
    if (deadline.aborted) return errorResponse("TIMEOUT", "Review timed out.");
    return errorResponse("REVIEW_UNAVAILABLE", "Review unavailable.");
  } finally {
    inflight.set(key, Math.max(0, (inflight.get(key) ?? 1) - 1));
    globalInflight = Math.max(0, globalInflight - 1);
  }
}

/**
 * Voice availability mirrors D's runtime gate (lib/voice/runtime.ts voiceMode + ElevenLabs config on
 * feat/voice-integration). Fixture mode serves D's labeled fixture audio. Live needs every setting; this
 * reports configuration only and never implies the provider is reachable.
 */
export function voiceConfigured(env: Record<string, string | undefined>): boolean {
  if (env.ENABLE_VOICE !== "true") return false;
  if (env.APP_MODE === "fixture") return true; // D's voiceMode(): only an explicit fixture mode serves fixture audio
  if (env.APP_MODE !== "live" || env.VOICE_SUPERVISED_DEMO !== "true") return false;
  if (!intInRange(env.VOICE_MAX_PROVIDER_CALLS, 1, 100)) return false;
  return ["ELEVENLABS_API_KEY", "ELEVENLABS_STT_MODEL", "ELEVENLABS_TTS_MODEL", "ELEVENLABS_VOICE_ID"].every((k) => Boolean(env[k]?.trim()));
}

export function handleHealth(env: Record<string, string | undefined> = process.env): Response {
  const cfg = readConfig(env);
  const liveReady = Boolean(env.XAI_API_KEY?.trim() && env.XAI_MODEL?.trim()) && liveReviewAllowed(cfg);
  const body: HealthResponse = {
    schemaVersion: SCHEMA_VERSION,
    contractRevision: CONTRACT_REVISION,
    appMode: cfg.appMode,
    policyVersion: POLICY_VERSION,
    corpusVersion: cfg.corpusVersion,
    capabilities: {
      review: cfg.appMode === "fixture" ? "fixture" : liveReady ? "live" : "unconfigured",
      retrieval: "local",
      voice: voiceConfigured(env),
      vision: false,
    },
  };
  return json(body);
}
