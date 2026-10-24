import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { synthesize } from "@/lib/providers/elevenlabs";
import { enforceOrigin, errorResponse, privateHeaders, readBoundedBody, VoiceError } from "@/lib/voice/http";
import { reserveVoiceCall, voiceMode } from "@/lib/voice/runtime";

export const runtime = "nodejs";
// Transport validation local to D. B owns the eventual shared contract exports.
const speechRequest = z.object({ text: z.string().trim().min(1).max(900), consent: z.literal(true) }).strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
  let release: (() => void) | undefined;
  try {
    enforceOrigin(request);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new VoiceError(415, "VALIDATION_ERROR", "Send JSON text and consent.");
    const mode = voiceMode();
    const bytes = await readBoundedBody(request, 8 * 1024, signal);
    let input: unknown;
    try { input = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new VoiceError(400, "VALIDATION_ERROR", "The speech request is not valid JSON."); }
    const parsed = speechRequest.safeParse(input);
    if (!parsed.success) throw new VoiceError(422, "VALIDATION_ERROR", "Send 1 to 900 characters and consent=true, with no extra fields.");
    release = reserveVoiceCall(mode);
    const audio = mode === "fixture"
      ? new Uint8Array(await readFile(join(process.cwd(), "data/voice/fixture-notice.mp3")))
      : await synthesize(parsed.data.text, signal);
    signal.throwIfAborted();
    return new Response(new Uint8Array(audio), { headers: { ...privateHeaders, "Content-Type": "audio/mpeg", "X-Request-Id": requestId, "X-LabMate-Mode": mode } });
  } catch (error) { return errorResponse(error, requestId, signal); }
  finally { release?.(); }
}
