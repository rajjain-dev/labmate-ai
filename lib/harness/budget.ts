import { HarnessError } from "./runReview";
let attempts = 0;
export function reviewConfigured(env: Record<string, string | undefined>) {
  const cap = Number(env.REVIEW_MAX_PROVIDER_CALLS);
  return Boolean(env.XAI_API_KEY?.trim() && env.XAI_MODEL?.trim() && env.REVIEW_SUPERVISED_DEMO === "true" && Number.isInteger(cap) && cap > 0 && cap <= 100);
}
export function reserveReviewAttempt() {
  if (!reviewConfigured(process.env) || attempts >= Number(process.env.REVIEW_MAX_PROVIDER_CALLS)) throw new HarnessError("REVIEW_UNAVAILABLE", "The supervised review allowance is unavailable or exhausted.");
  attempts++;
}
