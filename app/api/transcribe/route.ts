import { transcribe } from "@/lib/providers/elevenlabs";
import { enforceOrigin, errorResponse, privateHeaders, readBoundedBody, VoiceError } from "@/lib/voice/http";
import { MAX_AUDIO_BYTES, validateAudio } from "@/lib/voice/media";
import { reserveVoiceCall, voiceMode } from "@/lib/voice/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
  let release: (() => void) | undefined;
  try {
    enforceOrigin(request);
    const contentType = request.headers.get("content-type");
    if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) throw new VoiceError(415, "VALIDATION_ERROR", "Send a multipart audio recording.");
    const mode = voiceMode();
    const bytes = await readBoundedBody(request, MAX_AUDIO_BYTES + 64 * 1024, signal);
    let form: FormData;
    try { form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new VoiceError(400, "VALIDATION_ERROR", "The recording upload is malformed."); }
    const fields = [...form.keys()];
    const file = form.get("file");
    if (fields.length !== 2 || fields.some(key => key !== "file" && key !== "consent") || form.get("consent") !== "true" || !(file instanceof File)) {
      throw new VoiceError(422, "VALIDATION_ERROR", "Send exactly one recording and consent=true.");
    }
    const audio = await validateAudio(file);
    signal.throwIfAborted();
    release = reserveVoiceCall(mode);
    const transcript = mode === "fixture"
      ? "[Fixture transcript; no audio was transcribed.] Compare how water temperature affects dissolving time."
      : await transcribe(audio, signal);
    return Response.json({ requestId, transcript, requiresConfirmation: true }, { headers: { ...privateHeaders, "X-LabMate-Mode": mode } });
  } catch (error) { return errorResponse(error, requestId, signal); }
  finally { release?.(); }
}
