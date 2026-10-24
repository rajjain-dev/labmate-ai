import { z } from "zod";
import { trustedWebUrl } from "./web-sources";

export const LabDocumentSchema = z.object({
  title: z.string().min(1).max(160),
  pages: z.array(z.object({ number: z.number().int().min(1).max(25), text: z.string().max(24000) }).strict()).min(1).max(25),
}).strict().refine(lab => lab.pages.reduce((total, page) => total + page.text.length, 0) <= 24000, "The handout is too long.");
export type LabDocument = z.infer<typeof LabDocumentSchema>;
export const ConversationRequestSchema = z.object({
  lab: LabDocumentSchema,
  opening: z.boolean(),
  webResearch: z.boolean().optional().default(false),
  message: z.string().max(5000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2500) }).strict()).max(12),
}).strict();
export const WebSourceSchema = z.object({
  id: z.string().regex(/^web-[1-3]$/),
  title: z.string().min(1).max(160),
  url: z.string().max(2048).refine(value => trustedWebUrl(value) !== null),
  quote: z.string().min(8).max(400),
  kind: z.enum(["precaution", "explanation"]),
}).strict();
export type WebSource = z.infer<typeof WebSourceSchema>;
export const ResearchStatusSchema = z.enum(["used", "unavailable", "no_sources", "disabled", "not_needed"]);
export type ResearchStatus = z.infer<typeof ResearchStatusSchema>;
export const ConversationReplySchema = z.object({
  requestId: z.string().uuid(),
  answer: z.string().min(1).max(2000),
  precautions: z.array(z.object({ quote: z.string().min(1).max(500), page: z.number().int().min(1).max(25) }).strict()).max(20),
  citations: z.array(z.number().int().min(1).max(25)).max(25),
  webSources: z.array(WebSourceSchema).max(3).default([]),
  webCitations: z.array(z.string().regex(/^web-[1-3]$/)).max(3).default([]),
  researchStatus: ResearchStatusSchema.default("disabled"),
  mode: z.enum(["live", "fixture"]),
  emergency: z.boolean(),
}).strict();
export type ConversationReply = z.infer<typeof ConversationReplySchema>;
export type ConversationTurn = { role: "user" | "assistant"; content: string };
