/**
 * The model-owned subset of ReviewResponse (owner: B).
 * The model never supplies metadata, URLs, excerpts, request IDs, or speechText.
 */
import { z } from "zod";
import { ReviewStateSchema, EvidenceSchema } from "../contracts";

/** Lenient parse of model output; lengths/counts are enforced afterwards by normalizeModelReview. */
export const ModelReviewSchema = z.object({
  state: ReviewStateSchema,
  summary: z.string().min(1),
  missingInformation: z.array(z.string()),
  findings: z.array(
    z.object({
      category: z.enum(["scientific", "safety"]),
      severity: z.enum(["info", "caution", "stop"]),
      title: z.string().min(1),
      explanation: z.string().min(1),
      nextStep: z.string().min(1),
      evidence: EvidenceSchema,
      sourceIds: z.array(z.string()),
    }),
  ),
  questionsForTA: z.array(z.string()),
  limits: z.array(z.string()),
});
export type ModelReview = z.infer<typeof ModelReviewSchema>;

/** Strict JSON schema sent to Grok via Responses API text.format (all properties required, no extras). */
export const MODEL_REVIEW_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["state", "summary", "missingInformation", "findings", "questionsForTA", "limits"],
  properties: {
    state: {
      type: "string",
      enum: ["needs_clarification", "review_available", "supervisor_review_required", "emergency", "out_of_scope"],
    },
    summary: { type: "string" },
    missingInformation: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "severity", "title", "explanation", "nextStep", "evidence", "sourceIds"],
        properties: {
          category: { type: "string", enum: ["scientific", "safety"] },
          severity: { type: "string", enum: ["info", "caution", "stop"] },
          title: { type: "string" },
          explanation: { type: "string" },
          nextStep: { type: "string" },
          evidence: { type: "string", enum: ["source_backed", "reasoned", "unknown"] },
          sourceIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    questionsForTA: { type: "array", items: { type: "string" } },
    limits: { type: "array", items: { type: "string" } },
  },
};
