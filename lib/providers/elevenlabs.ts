import "server-only";
import { readBoundedBody, VoiceError } from "@/lib/voice/http";

const baseUrl = "https://api.elevenlabs.io/v1";

function config(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new VoiceError(503, "REVIEW_UNAVAILABLE", "Live voice is not configured. Text remains available.");
  return value;
}

async function providerResponse(url: string, init: RequestInit, signal: AbortSignal) {
  const response = await fetch(url, { ...init, signal, cache: "no-store", redirect: "error" });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new VoiceError(429, "RATE_LIMITED", "The voice provider is busy. Try again in a minute.", true);
    throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider is unavailable. Text remains available.", true);
  }
  return response;
}

export async function transcribe(audio: { bytes: Uint8Array; mimeType: string }, signal: AbortSignal): Promise<string> {
  const key = config("ELEVENLABS_API_KEY");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(audio.bytes)], { type: audio.mimeType }), audio.mimeType === "audio/webm" ? "recording.webm" : "recording.mp4");
  form.set("model_id", config("ELEVENLABS_STT_MODEL"));
  form.set("diarize", "false");
  form.set("tag_audio_events", "false");
  form.set("timestamps_granularity", "none");
  const response = await providerResponse(`${baseUrl}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: form }, signal);
  if (!response.headers.get("content-type")?.includes("application/json")) throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider returned an unreadable transcript.", true);
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(await readBoundedBody(response, 64 * 1024, signal))); }
  catch (error) { if (signal.aborted) throw error; throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider returned an unreadable transcript.", true); }
  const text = data && typeof data === "object" && "text" in data ? data.text : null;
  if (typeof text !== "string" || !text.trim() || text.length > 5000) throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider returned an unreadable transcript.", true);
  return text.trim();
}

export async function synthesize(text: string, signal: AbortSignal): Promise<Uint8Array> {
  const key = config("ELEVENLABS_API_KEY");
  const voice = encodeURIComponent(config("ELEVENLABS_VOICE_ID"));
  const model = config("ELEVENLABS_TTS_MODEL");
  const response = await providerResponse(`${baseUrl}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model }),
  }, signal);
  if (!response.headers.get("content-type")?.includes("audio/mpeg")) throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider returned unreadable audio.", true);
  let bytes: Uint8Array;
  try { bytes = await readBoundedBody(response, 2 * 1024 * 1024, signal); }
  catch (error) { if (signal.aborted) throw error; throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider returned unreadable audio.", true); }
  const mp3 = bytes.length > 3 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (!mp3) throw new VoiceError(502, "UPSTREAM_INVALID", "The voice provider returned unreadable audio.", true);
  return bytes;
}
