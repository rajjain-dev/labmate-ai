import "server-only";

export class VoiceError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) {
    super(message);
  }
}

export const privateHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function readBoundedBody(source: Request | Response, limit: number, signal: AbortSignal): Promise<Uint8Array> {
  const declared = source.headers.get("content-length");
  if (declared && Number(declared) > limit) throw new VoiceError(413, "VALIDATION_ERROR", "The request is too large.");
  const reader = source.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new VoiceError(413, "VALIDATION_ERROR", "The request is too large.");
      }
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export function enforceOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's standalone request URL may use an internal hostname. Compare the
  // browser Origin to the incoming Host, or a fixed deployment origin. Never
  // trust a caller-supplied X-Forwarded-Host to widen the allowed origin.
  const url = new URL(request.url);
  let expected: string;
  try { expected = new URL(process.env.APP_ORIGIN || `${url.protocol}//${request.headers.get("host") || url.host}`).origin; }
  catch { throw new VoiceError(503, "REVIEW_UNAVAILABLE", "The application origin is not configured."); }
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected)) {
    throw new VoiceError(403, "FORBIDDEN", "Use voice from this application's page.");
  }
}

export function errorResponse(error: unknown, requestId: string, signal: AbortSignal) {
  const failure = signal.aborted
    ? new VoiceError(504, "TIMEOUT", "Voice timed out or was cancelled. Text remains available.", true)
    : error instanceof VoiceError ? error
    : new VoiceError(502, "UPSTREAM_INVALID", "Voice is unavailable. Text remains available.", true);
  return Response.json({ requestId, error: { code: failure.code, message: failure.message, retryable: failure.retryable } }, {
    status: failure.status,
    headers: { ...privateHeaders, ...(failure.status === 429 ? { "Retry-After": "60" } : {}) },
  });
}
