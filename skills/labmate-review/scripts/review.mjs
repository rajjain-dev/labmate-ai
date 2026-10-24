#!/usr/bin/env node
// labmate-review skill script (owner: B). License: MIT (see ../LICENSE).
// Sends a schema 1.0 ReviewRequest to a running LabMate app's POST /api/review, so every review comes from the
// same tested harness and policy as the app. This file contains no review or safety logic; it only transports
// and prints. Output text is treated as untrusted and printed as plain text.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export const DEFAULT_BASE_URL = "http://localhost:3000";
export const EXIT = { OK: 0, API_ERROR: 1, USAGE: 2, UNREACHABLE: 3 };

const USAGE = `Usage: node skills/labmate-review/scripts/review.mjs <request.json | -> [--url URL] [--json]
  --url URL   LabMate app base URL (default: $LABMATE_URL or ${DEFAULT_BASE_URL})
  --json      print the raw response body instead of the text report`;

/** Remove terminal control sequences and other control characters from untrusted text. */
export function plain(value) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "");
}

export function parseArgs(argv) {
  const out = { file: null, url: process.env.LABMATE_URL || DEFAULT_BASE_URL, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--url") out.url = argv[++i];
    else if (a === "-h" || a === "--help") return { ...out, help: true };
    else if (!out.file) out.file = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  if (!out.file) throw new Error("A request file (or - for stdin) is required.");
  if (!out.url) throw new Error("--url needs a value.");
  return out;
}

/** Parse request JSON. Only fills a missing clientRequestId; the app validates everything else. */
export function prepareRequest(text) {
  const req = JSON.parse(text);
  if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("The request must be a JSON object.");
  return req.clientRequestId ? req : { ...req, clientRequestId: randomUUID() };
}

export async function requestReview(request, { baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
  const url = new URL("/api/review", baseUrl);
  const res = await fetchImpl(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    }),
  );
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, mode: res.headers.get("x-labmate-mode"), body };
}

const bullet = (items) => (items?.length ? items.map((x) => `  - ${plain(x)}`).join("\n") : "  (none)");

export function formatReview({ status, mode, body }) {
  if (status !== 200 || !body || body.error) {
    const e = body?.error;
    return e
      ? `LabMate error ${status} ${plain(e.code)} (retryable: ${e.retryable ? "yes" : "no"}): ${plain(e.message)}`
      : `LabMate error ${status}: the app did not return a readable response.`;
  }
  const r = body;
  const shownMode = plain(mode || r.meta?.mode || "unknown");
  const lines = [
    `LabMate review | mode: ${shownMode.toUpperCase()}${shownMode === "fixture" ? " (canned example, not an assessment of this plan)" : ""}`,
    `State: ${plain(r.state)}`,
    `Summary: ${plain(r.summary)}`,
    "",
    "Missing information:",
    bullet(r.missingInformation),
    "",
    "Findings:",
  ];
  if (!r.findings?.length) lines.push("  (none)");
  for (const f of r.findings ?? []) {
    lines.push(`  [${plain(f.id)}] ${plain(f.severity)} | ${plain(f.category)} | evidence: ${plain(f.evidence)}`);
    lines.push(`      ${plain(f.title)}`);
    lines.push(`      ${plain(f.explanation)}`);
    lines.push(`      Next step: ${plain(f.nextStep)}`);
    if (f.sourceIds?.length) lines.push(`      Sources: ${f.sourceIds.map(plain).join(", ")}`);
  }
  lines.push("", "Questions for your TA:", bullet(r.questionsForTA), "", "Sources:");
  if (!r.sources?.length) lines.push("  (none)");
  for (const s of r.sources ?? []) {
    lines.push(`  [${plain(s.sourceId)}] ${plain(s.title)}, ${plain(s.locator)} (${plain(s.sourceKind)}, v${plain(s.version)}, reviewed ${plain(s.reviewedOn)})${s.url ? ` ${plain(s.url)}` : ""}`);
  }
  lines.push("", "Limits:", bullet(r.limits));
  if (r.meta?.warnings?.length) lines.push("", "Warnings:", bullet(r.meta.warnings));
  lines.push("", `retrieval: ${plain(r.meta?.retrieval)} | generation: ${plain(r.meta?.generation)} | policy: ${plain(r.meta?.policyVersion)} | requestId: ${plain(r.requestId)}`);
  return lines.join("\n");
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

export async function main(argv = process.argv.slice(2), io = { log: console.log, error: console.error }) {
  let args;
  let request;
  try {
    args = parseArgs(argv);
    if (args.help) {
      io.log(USAGE);
      return EXIT.OK;
    }
    request = prepareRequest(args.file === "-" ? await readStdin() : await readFile(args.file, "utf8"));
  } catch (e) {
    io.error(`${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
    return EXIT.USAGE;
  }
  let result;
  try {
    result = await requestReview(request, { baseUrl: args.url });
  } catch (e) {
    io.error(`Could not reach LabMate at ${args.url}: ${e instanceof Error ? e.message : String(e)}. Is the app running (npm run dev)?`);
    return EXIT.UNREACHABLE;
  }
  io.log(args.json ? JSON.stringify(result.body, null, 2) : formatReview(result));
  return result.status === 200 ? EXIT.OK : EXIT.API_ERROR;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
