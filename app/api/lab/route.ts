import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { LabDocumentSchema } from "@/lib/lab/contracts";
import { enforceOrigin, errorResponse, privateHeaders, readBoundedBody, VoiceError } from "@/lib/voice/http";

export const runtime = "nodejs";
const MAX_PDF_BYTES = 5 * 1024 * 1024;
let active = 0;
let recent: number[] = [];

async function extract(bytes: ArrayBuffer, signal: AbortSignal): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    // Runtime --env-file points at the launch directory, not the standalone
    // checkout. The worker already inherits loaded env; don't replay CLI flags.
    // Keep bytes inside an object: Turbopack adds worker runtime properties.
    const worker = new Worker(join(process.cwd(), "scripts/extract-lab-pdf.mjs"), { workerData: { bytes }, transferList: [bytes], execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32 }, stdout: true, stderr: true });
    let settled = false;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); void worker.terminate(); };
    const fail = () => { if (settled) return; settled = true; cleanup(); reject(new VoiceError(422, "VALIDATION_ERROR", "That PDF could not be read. Use a PDF with selectable text, up to 25 pages.")); };
    const abort = () => { if (settled) return; settled = true; cleanup(); reject(signal.reason); };
    const timer = setTimeout(fail, 8000);
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", message => { if (settled) return; settled = true; cleanup(); resolve(message); });
    worker.once("error", fail);
    worker.once("exit", code => { if (code !== 0) fail(); });
    if (signal.aborted) abort();
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
  let reserved = false;
  try {
    enforceOrigin(request);
    const type = request.headers.get("Content-Type") || "";
    if (!type.toLowerCase().startsWith("multipart/form-data;")) throw new VoiceError(415, "VALIDATION_ERROR", "Upload a PDF file.");
    recent = recent.filter(time => Date.now() - time < 60_000);
    if (active >= 2 || recent.length >= 5) throw new VoiceError(429, "RATE_LIMITED", "Please wait a moment before uploading another PDF.", true);
    active++; recent.push(Date.now()); reserved = true;
    const body = await readBoundedBody(request, MAX_PDF_BYTES + 64 * 1024, signal);
    let form: FormData;
    try { form = await new Response(new Uint8Array(body), { headers: { "Content-Type": type } }).formData(); }
    catch { throw new VoiceError(400, "VALIDATION_ERROR", "The PDF upload could not be read."); }
    const file = form.get("file");
    if ([...form.keys()].length !== 1 || !(file instanceof File)) throw new VoiceError(422, "VALIDATION_ERROR", "Upload one PDF file.");
    if (file.size > MAX_PDF_BYTES) throw new VoiceError(413, "VALIDATION_ERROR", "Use a PDF smaller than 5 MiB.");
    const bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength))) !== "%PDF-") throw new VoiceError(415, "VALIDATION_ERROR", "Use a PDF with selectable text.");
    const extracted = await extract(bytes, signal) as { pages?: unknown; error?: string };
    if (extracted.error) {
      const messages: Record<string, string> = { PAGE_LIMIT: "Use a handout with up to 25 pages.", TEXT_LIMIT: "This handout is too long. Upload the pages for one experiment (up to 24,000 characters).", NO_TEXT: "This PDF has no readable text. Use a PDF with selectable text." };
      throw new VoiceError(422, "VALIDATION_ERROR", messages[extracted.error] || "The PDF could not be read. Use a PDF with selectable text.");
    }
    const document = LabDocumentSchema.parse({ title: file.name.replace(/[\x00-\x1f]/g, "").slice(0, 160) || "Lab handout.pdf", pages: extracted.pages });
    return Response.json({ document }, { headers: privateHeaders });
  } catch (error) { return errorResponse(error, requestId, signal); }
  finally { if (reserved) active--; }
}
