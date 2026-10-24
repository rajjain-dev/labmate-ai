import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let speech: typeof import("@/app/api/speech/route").POST;
let transcribe: typeof import("@/app/api/transcribe/route").POST;
const origin = "http://localhost:3000";

beforeEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules();
  vi.stubEnv("ENABLE_VOICE", "true"); vi.stubEnv("APP_MODE", "fixture");
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("VOICE_SUPERVISED_DEMO", "false"); vi.stubEnv("VOICE_MAX_PROVIDER_CALLS", "0");
  vi.stubEnv("ELEVENLABS_API_KEY", "test-secret-never-echo");
  vi.stubEnv("ELEVENLABS_STT_MODEL", "test-stt");
  vi.stubEnv("ELEVENLABS_TTS_MODEL", "test-tts");
  vi.stubEnv("ELEVENLABS_VOICE_ID", "fixed-voice");
  speech = (await import("@/app/api/speech/route")).POST;
  transcribe = (await import("@/app/api/transcribe/route")).POST;
});

function live() { vi.stubEnv("APP_MODE", "live"); vi.stubEnv("VOICE_SUPERVISED_DEMO", "true"); vi.stubEnv("VOICE_MAX_PROVIDER_CALLS", "20"); }
function speechRequest(body: unknown = { text: "Summary with a limitation.", consent: true }, extra: RequestInit = {}) {
  return new Request(`${origin}/api/speech`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body), ...extra });
}
async function audioRequest(name = "short.webm", mime = "audio/webm", extra?: (form: FormData) => void) {
  const bytes = await readFile(new URL(`./media/${name}`, import.meta.url));
  const form = new FormData(); form.set("file", new File([bytes], name, { type: mime })); form.set("consent", "true"); extra?.(form);
  return new Request(`${origin}/api/transcribe`, { method: "POST", headers: { Origin: origin }, body: form });
}
const mp3 = () => readFile(new URL("../../data/voice/fixture-notice.mp3", import.meta.url));

describe("voice transport and mode boundaries", () => {
  it("defaults to disabled and makes no provider call", async () => {
    vi.stubEnv("ENABLE_VOICE", "false"); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const response = await speech(speechRequest());
    expect(response.status).toBe(503); expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).error.code).toBe("REVIEW_UNAVAILABLE");
  });
  it("blocks unconfigured and public live mode", async () => {
    vi.stubEnv("APP_MODE", "live");
    expect((await speech(speechRequest())).status).toBe(503);
    live(); vi.stubEnv("ELEVENLABS_API_KEY", "");
    expect((await speech(speechRequest())).status).toBe(503);
  });
  it("rejects cross-origin calls before a provider call", async () => {
    const request = speechRequest(undefined, { headers: { Origin: "https://elsewhere.example", "Content-Type": "application/json" } });
    expect((await speech(request)).status).toBe(403);
  });
  it("accepts the browser host when Next uses an internal request hostname", async () => {
    const request = new Request("http://localhost:3000/api/speech", { method: "POST", headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" }, body: JSON.stringify({ text: "summary", consent: true }) });
    expect((await speech(request)).status).toBe(200);
  });
  it("uses a fixed configured proxy origin and ignores X-Forwarded-Host", async () => {
    vi.stubEnv("APP_ORIGIN", "https://labmate.example");
    expect((await speech(speechRequest(undefined, { headers: { "Content-Type": "application/json", Host: "internal:3000", Origin: "https://labmate.example" } }))).status).toBe(200);
    expect((await speech(speechRequest(undefined, { headers: { "Content-Type": "application/json", Host: "internal:3000", "X-Forwarded-Host": "other.example", Origin: "https://other.example" } }))).status).toBe(403);
  });
  it.each([{ text: "hello", consent: false }, { text: "", consent: true }, { text: "a".repeat(901), consent: true }, { text: "hi", consent: true, voiceId: "override" }])("rejects invalid speech payload %j", async body => {
    expect((await speech(speechRequest(body))).status).toBe(422);
  });
  it("distinguishes malformed JSON from oversized and unsupported bodies", async () => {
    expect((await speech(speechRequest(undefined, { body: "{" }))).status).toBe(400);
    expect((await speech(speechRequest(undefined, { body: "x".repeat(8193) }))).status).toBe(413);
    expect((await speech(speechRequest(undefined, { headers: { "Content-Type": "text/plain" } }))).status).toBe(415);
  });
  it("enforces actual streaming size without trusting Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(5000)); c.enqueue(new Uint8Array(5000)); c.close(); } });
    const request = new Request(`${origin}/api/speech`, { method: "POST", body, headers: { "Content-Type": "application/json" }, duplex: "half" } as RequestInit);
    expect((await speech(request)).status).toBe(413);
  });
  it("returns a labeled local fixture announcement without a provider call", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const response = await speech(speechRequest());
    expect(response.status).toBe(200); expect(response.headers.get("X-LabMate-Mode")).toBe("fixture");
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(await mp3())); expect(fetch).not.toHaveBeenCalled();
  });
});

describe("audio validation and transcription", () => {
  it.each([["short.webm", "audio/webm"], ["short.mp4", "audio/mp4"]])("accepts readable %s and requires confirmation", async (name, mime) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const response = await transcribe(await audioRequest(name, mime));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-LabMate-Mode")).toBe("fixture");
    expect(await response.json()).toMatchObject({ requiresConfirmation: true, transcript: expect.stringContaining("Fixture transcript") });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects spoofed signatures, unsupported MIME and empty files", async () => {
    expect((await transcribe(await audioRequest("short.webm", "audio/mp4"))).status).toBe(415);
    expect((await transcribe(await audioRequest("short.webm", "audio/wav"))).status).toBe(415);
    expect((await transcribe(await audioRequest("short.webm", "audio/webm", form => form.set("file", new File([], "empty.webm", { type: "audio/webm" }))))).status).toBe(422);
  });
  it("derives streaming duration and rejects long audio or client duration claims", async () => {
    expect((await transcribe(await audioRequest("too-long.webm"))).status).toBe(422);
    expect((await transcribe(await audioRequest("unknown-duration.webm"))).status).toBe(200);
    expect((await transcribe(await audioRequest("short.webm", "audio/webm", form => form.set("duration", "1")))).status).toBe(422);
  });
  it("rejects missing consent, duplicate files and excessive bytes before forwarding", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await transcribe(await audioRequest("short.webm", "audio/webm", form => form.delete("consent")))).status).toBe(422);
    expect((await transcribe(await audioRequest("short.webm", "audio/webm", form => form.append("file", form.get("file")!)))).status).toBe(422);
    expect((await transcribe(await audioRequest("short.webm", "audio/webm", form => form.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.webm", { type: "audio/webm" }))))).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards validated audio to the fixed transcription endpoint", async () => {
    live(); const fetch = vi.fn().mockResolvedValue(Response.json({ text: "Check that the quantity is not ten grams." })); vi.stubGlobal("fetch", fetch);
    const response = await transcribe(await audioRequest());
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ transcript: "Check that the quantity is not ten grams.", requiresConfirmation: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(init.body.get("model_id")).toBe("test-stt"); expect(init.body.get("diarize")).toBe("false");
    expect(init.signal).toBeInstanceOf(AbortSignal); expect(init.redirect).toBe("error");
  });
  it("rejects malformed upstream transcripts without silent fixture fallback", async () => {
    live(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ text: "" })));
    const response = await transcribe(await audioRequest());
    expect(response.status).toBe(502); expect(response.headers.get("X-LabMate-Mode")).toBeNull();
  });
  it.each([[5000, 200], [5001, 502]])("enforces the proposed C001 transcript limit at %i characters", async (length, status) => {
    live(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ text: "a".repeat(length) })));
    expect((await transcribe(await audioRequest())).status).toBe(status);
  });
});

describe("provider budgets, cancellation and failure privacy", () => {
  it("fixes voice, model and output format server-side", async () => {
    live(); const fetch = vi.fn().mockResolvedValue(new Response(await mp3(), { headers: { "Content-Type": "audio/mpeg" } })); vi.stubGlobal("fetch", fetch);
    const response = await speech(speechRequest());
    expect(response.status).toBe(200); expect(response.headers.get("X-LabMate-Mode")).toBe("live");
    expect(fetch.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/text-to-speech/fixed-voice?output_format=mp3_44100_128");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ text: "Summary with a limitation.", model_id: "test-tts" });
  });
  it("sanitizes provider errors and does not retry or turn failures into fixtures", async () => {
    live(); const fetch = vi.fn().mockResolvedValue(new Response("test-secret-never-echo account identifier", { status: 401 })); vi.stubGlobal("fetch", fetch);
    const response = await speech(speechRequest()); const body = await response.text();
    expect(response.status).toBe(502); expect(body).not.toContain("test-secret"); expect(body).not.toContain("account identifier"); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects upstream non-audio, empty audio and oversized responses", async () => {
    live(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const response of [new Response("html", { headers: { "Content-Type": "text/html" } }), new Response("", { headers: { "Content-Type": "audio/mpeg" } }), new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { "Content-Type": "audio/mpeg" } })]) {
      fetch.mockResolvedValueOnce(response); expect((await speech(speechRequest())).status).toBe(502);
    }
  });
  it("returns Retry-After for upstream rate limiting", async () => {
    live(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hidden", { status: 429 })));
    const response = await speech(speechRequest()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
  });
  it("limits all voice routes to five requests per minute", async () => {
    for (let i = 0; i < 5; i++) expect((await transcribe(await audioRequest())).status).toBe(200);
    const response = await speech(speechRequest()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
  });
  it("applies the supervised process allowance before a second provider attempt", async () => {
    live(); vi.stubEnv("VOICE_MAX_PROVIDER_CALLS", "1"); const fetch = vi.fn().mockResolvedValue(new Response(await mp3(), { headers: { "Content-Type": "audio/mpeg" } })); vi.stubGlobal("fetch", fetch);
    expect((await speech(speechRequest())).status).toBe(200); expect((await speech(speechRequest())).status).toBe(503); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("propagates cancellation and frees concurrency slots", async () => {
    live(); const controllers = [new AbortController(), new AbortController()];
    const fetch = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => { init.signal.addEventListener("abort", () => reject(new DOMException("Abort", "AbortError")), { once: true }); })); vi.stubGlobal("fetch", fetch);
    const pending = controllers.map(controller => speech(speechRequest(undefined, { signal: controller.signal })));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect((await speech(speechRequest())).status).toBe(429);
    controllers.forEach(controller => controller.abort());
    expect((await Promise.all(pending)).map(response => response.status)).toEqual([504, 504]);
    fetch.mockResolvedValue(new Response(await mp3(), { headers: { "Content-Type": "audio/mpeg" } }));
    expect((await speech(speechRequest())).status).toBe(200);
  });
  it("enforces the 15-second shared deadline", async () => {
    const controller = new AbortController(); const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    live(); vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("private upstream timeout")), { once: true }))));
    const pending = speech(speechRequest()); await vi.waitFor(() => expect(timeout).toHaveBeenCalledWith(15_000));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled()); controller.abort();
    const response = await pending; expect(response.status).toBe(504); expect((await response.json()).error.code).toBe("TIMEOUT");
  });
});
