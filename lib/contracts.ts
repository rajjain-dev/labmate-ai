/**
 * LabMate shared contracts — wire schema 1.0, contract revision C001 (proposed).
 * Owner: B. Consumers (A, C, D) import types and schemas from here; never fork them.
 * Change procedure: CONTRACT_PROPOSAL -> ACKs from affected owners -> D records decision.
 */
import { z } from "zod";

export const SCHEMA_VERSION = "1.0" as const;
export const CONTRACT_REVISION = "C001" as const;

// ---------------------------------------------------------------------------
// Request and source contracts (handoff section 7)
// ---------------------------------------------------------------------------

export const ContextIdSchema = z.enum(["intro-chem-demo"]);
export type ContextId = z.infer<typeof ContextIdSchema>;

const item = (max: number) => z.string().trim().min(1).max(max);

export const ReviewRequestSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    clientRequestId: z.string().uuid(),
    contextId: ContextIdSchema,
    goal: z.string().trim().min(10).max(1000),
    materials: z.array(item(120)).max(20),
    steps: z.array(item(300)).min(1).max(20),
    equipment: z.array(item(120)).max(20),
    conditions: z.string().max(1000), // empty is valid and meaningful
    question: z.string().max(500),
    inputMode: z.enum(["typed", "voice_confirmed"]),
  })
  .strict();
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const SourceKindSchema = z.enum(["course_protocol", "sds", "general_guidance"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourcePassageSchema = z
  .object({
    sourceId: z.string().min(1).max(120), // immutable chunk ID
    documentId: z.string().min(1).max(120),
    title: z.string().min(1).max(300),
    locator: z.string().min(1).max(200), // page or section, never fabricated
    excerpt: z.string().min(1).max(1200),
    url: z.string().url().startsWith("https://").nullable(), // server allowlisted
    sourceKind: SourceKindSchema,
    version: z.string().min(1).max(60),
    reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type SourcePassage = z.infer<typeof SourcePassageSchema>;

export const RetrievalResultSchema = z
  .object({
    provider: z.enum(["snowflake", "local"]),
    passages: z.array(SourcePassageSchema).max(5),
    warning: z.string().max(300).nullable(),
  })
  .strict();
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

// ---------------------------------------------------------------------------
// Review response contract (handoff section 8)
// ---------------------------------------------------------------------------

export const ReviewStateSchema = z.enum([
  "needs_clarification",
  "review_available",
  "supervisor_review_required",
  "emergency",
  "out_of_scope",
]);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

export const EvidenceSchema = z.enum(["source_backed", "reasoned", "unknown"]);
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FindingSchema = z
  .object({
    id: z.string().min(1).max(40),
    category: z.enum(["scientific", "safety"]),
    severity: z.enum(["info", "caution", "stop"]),
    title: z.string().min(1).max(100),
    explanation: z.string().min(1).max(600),
    nextStep: z.string().min(1).max(300),
    evidence: EvidenceSchema,
    sourceIds: z.array(z.string().min(1)).max(3),
  })
  .strict();
export type Finding = z.infer<typeof FindingSchema>;

export const ReviewMetaSchema = z
  .object({
    mode: z.enum(["live", "fixture"]),
    generation: z.enum(["grok", "policy", "fixture"]),
    retrieval: z.enum(["snowflake", "local", "none"]),
    corpusVersion: z.string(),
    policyVersion: z.string(),
    model: z.string().nullable(),
    latencyMs: z.number().int().nonnegative(),
    warnings: z.array(z.string().max(300)).max(10),
  })
  .strict();
export type ReviewMeta = z.infer<typeof ReviewMetaSchema>;

export const ReviewResponseSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    requestId: z.string().uuid(),
    clientRequestId: z.string().uuid(),
    state: ReviewStateSchema,
    summary: z.string().min(1).max(700),
    missingInformation: z.array(z.string().min(1).max(200)).max(6),
    findings: z.array(FindingSchema).max(8),
    questionsForTA: z.array(z.string().min(1).max(200)).max(5),
    sources: z.array(SourcePassageSchema).max(5),
    limits: z.array(z.string().min(1).max(200)).min(1).max(4),
    speechText: z.string().min(1).max(900),
    meta: ReviewMetaSchema,
  })
  .strict()
  .superRefine((r, ctx) => {
    const ids = new Set(r.sources.map((s) => s.sourceId));
    r.findings.forEach((f, i) => {
      for (const id of f.sourceIds) {
        if (!ids.has(id)) ctx.addIssue({ code: "custom", path: ["findings", i, "sourceIds"], message: `Unknown sourceId ${id}` });
      }
      if (f.evidence === "source_backed" && f.sourceIds.length === 0) {
        ctx.addIssue({ code: "custom", path: ["findings", i, "evidence"], message: "source_backed finding needs a sourceId" });
      }
    });
  });
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

// ---------------------------------------------------------------------------
// Errors and other endpoints (handoff section 9)
// ---------------------------------------------------------------------------

export const ErrorCodeSchema = z.enum([
  "BAD_REQUEST", // 400 malformed body
  "PAYLOAD_TOO_LARGE", // 413
  "UNSUPPORTED_MEDIA", // 415
  "VALIDATION_ERROR", // 422
  "RATE_LIMITED", // 429 (+ Retry-After header)
  "UPSTREAM_INVALID", // 502
  "REVIEW_UNAVAILABLE", // 503 missing credentials or provider down
  "TIMEOUT", // 504
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    error: z.object({ code: ErrorCodeSchema, message: z.string(), retryable: z.boolean() }).strict(),
  })
  .strict();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/** POST /api/transcribe success body (D). Request: multipart `file` + `consent=true`. */
export const TranscribeResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    transcript: z.string().max(5000),
    requiresConfirmation: z.literal(true),
  })
  .strict();
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;

/** POST /api/speech request body (D). Success: 200 audio/mpeg bytes. */
export const SpeechRequestSchema = z
  .object({ text: z.string().min(1).max(900), consent: z.literal(true) })
  .strict();
export type SpeechRequest = z.infer<typeof SpeechRequestSchema>;

/** GET /api/health (B). Sanitized: no credentials or account identifiers. */
export const HealthResponseSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    contractRevision: z.string(),
    appMode: z.enum(["live", "fixture"]),
    policyVersion: z.string(),
    corpusVersion: z.string(),
    capabilities: z
      .object({
        review: z.enum(["live", "fixture", "unconfigured"]),
        retrieval: z.enum(["snowflake", "local"]),
        voice: z.boolean(),
        vision: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** POST /api/vision response (stretch, section 14). */
export const VisionResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    state: z.enum(["observations_available", "unusable_image"]),
    observations: z.array(
      z
        .object({
          item: z.enum(["eye_protection", "lab_coat", "footwear", "hair_restraint", "workspace_obstruction"]),
          visibility: z.enum(["visible", "not_visible", "uncertain"]),
          note: z.string().max(250),
        })
        .strict(),
    ),
    limits: z.array(z.string()),
    mode: z.enum(["live", "fixture"]),
  })
  .strict();
export type VisionResponse = z.infer<typeof VisionResponseSchema>;

// ---------------------------------------------------------------------------
// Provider seams (handoff section 19 "Required seams")
// ---------------------------------------------------------------------------

/** C implements for Snowflake and for the local corpus fallback. Must return RetrievalResultSchema-valid data. */
export type RetrieveFn = (request: ReviewRequest, signal: AbortSignal) => Promise<RetrievalResult>;

/** B implements (Grok). Returns the raw model text (expected JSON) and the model name actually used. */
export interface GenerateInput {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
}
export type GenerateFn = (input: GenerateInput, signal: AbortSignal) => Promise<{ text: string; model: string }>;

/** D implements (ElevenLabs). Audio is already validated by the route. */
export type TranscribeFn = (audio: { bytes: Uint8Array; mimeType: string }, signal: AbortSignal) => Promise<string>;
export type SynthesizeFn = (text: string, signal: AbortSignal) => Promise<Uint8Array>;

/** Harness entry point (B). HTTP handlers validate transport and call this. */
export interface ReviewDependencies {
  retrieve: RetrieveFn | null; // null = retrieval not configured
  generate: GenerateFn | null; // null = live generation not configured
  clock: () => number; // ms timestamp
  makeId: () => string; // UUID
}

// ---------------------------------------------------------------------------
// Voice component props (D supplies components/voice/, A mounts them)
// ---------------------------------------------------------------------------

export interface VoiceRecorderProps {
  /** Disable while a review call is in flight. */
  disabled?: boolean;
  /** Called with the editable draft transcript; A puts it in an editable field and requires confirmation. */
  onTranscript: (transcript: string) => void;
  /** Human readable error; A keeps the typed form usable. */
  onError?: (message: string) => void;
}

export interface SpeechButtonProps {
  /** Only the latest validated ReviewResponse.speechText; null hides/disables the button. */
  speechText: string | null;
  disabled?: boolean;
}
