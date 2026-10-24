import "server-only";
import { VoiceError } from "./http";

// Deliberately stricter than a per-session limit: one supervised Node process.
// This is not a distributed or public deployment limiter.
let windowStarted = 0;
let callsThisMinute = 0;
let active = 0;
let providerCalls = 0;

export function voiceMode(): "fixture" | "live" {
  if (process.env.ENABLE_VOICE !== "true") throw new VoiceError(503, "REVIEW_UNAVAILABLE", "Voice is disabled. You can type your plan.");
  if (process.env.APP_MODE === "fixture") return "fixture";
  const cap = Number(process.env.VOICE_MAX_PROVIDER_CALLS);
  if (process.env.APP_MODE !== "live" || process.env.VOICE_SUPERVISED_DEMO !== "true" || !Number.isInteger(cap) || cap < 1 || cap > 100) {
    throw new VoiceError(503, "REVIEW_UNAVAILABLE", "Live voice is not configured for this demo. Text remains available.");
  }
  return "live";
}

export function reserveVoiceCall(mode: "fixture" | "live") {
  const now = Date.now();
  if (now - windowStarted >= 60_000) { windowStarted = now; callsThisMinute = 0; }
  if (callsThisMinute >= 5 || active >= 2) throw new VoiceError(429, "RATE_LIMITED", "Voice is busy. Try again in a minute.", true);
  if (mode === "live" && providerCalls >= Number(process.env.VOICE_MAX_PROVIDER_CALLS)) {
    throw new VoiceError(503, "REVIEW_UNAVAILABLE", "This demo's voice allowance is exhausted. Text remains available.");
  }
  callsThisMinute++;
  active++;
  if (mode === "live") providerCalls++;
  return () => { active--; };
}
