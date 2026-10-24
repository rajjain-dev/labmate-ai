import corpus from "../../data/corpus.json";
import { RetrievalResultSchema, SourcePassageSchema, type ReviewRequest, type RetrieveFn, type RetrievalResult } from "../contracts";

export function retrieveLocalPassages(request: ReviewRequest): RetrievalResult {
  const words = new Set([request.goal, ...request.materials, ...request.steps, ...request.equipment, request.conditions, request.question].join(" ").toLowerCase().match(/[a-z]{3,}/g) ?? []);
  const passages = corpus.map(({ tags, ...passage }) => ({ passage, score: tags.filter(tag => [...words].some(word => word.startsWith(tag) || tag.startsWith(word))).length }))
    .filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map(entry => SourcePassageSchema.parse(entry.passage));
  return RetrievalResultSchema.parse({ provider: "local", passages, warning: "Local NIST experimental-design excerpts only. No course protocol or material-specific SDS is included; safety requirements need your supervisor." });
}

export const localRetrieve: RetrieveFn = async (request, signal) => { signal.throwIfAborted(); return retrieveLocalPassages(request); };
