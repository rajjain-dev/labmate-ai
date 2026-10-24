/**
 * Grok adapter (owner: B). Server only. xAI Responses API with strict JSON schema output.
 * Env: XAI_API_KEY, XAI_MODEL (a model verified in the team's account — do not guess).
 */
import type { GenerateFn } from "../contracts";
import { reserveReviewAttempt } from "../harness/budget";
import { readBoundedBody } from "../voice/http";

const XAI_URL = "https://api.x.ai/v1/responses";

export class ProviderError extends Error {
  constructor(public status: number | null, message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Pull the assistant text out of a Responses API payload without assuming array order. */
export function extractOutputText(data: unknown): string {
  const d = data as { output_text?: unknown; output?: unknown };
  if (typeof d?.output_text === "string" && d.output_text.length > 0) return d.output_text;
  if (Array.isArray(d?.output)) {
    for (const item of d.output as Array<{ type?: string; content?: unknown }>) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const c of item.content as Array<{ type?: string; text?: unknown }>) {
        if ((c?.type === "output_text" || c?.type === "text") && typeof c.text === "string") return c.text;
      }
    }
  }
  throw new ProviderError(null, "No text output in Grok response");
}

export function createGrokGenerate(env: Record<string, string | undefined> = process.env): GenerateFn | null {
  const key = env.XAI_API_KEY;
  const model = env.XAI_MODEL;
  if (!key || !model) return null;
  return async (input, signal) => {
    reserveReviewAttempt();
    const res = await fetch(XAI_URL, {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 2400,
        input: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        text: {
          format: { type: "json_schema", name: "labmate_review", strict: true, schema: input.jsonSchema },
        },
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      // Never forward provider error bodies to clients; log status only.
      throw new ProviderError(res.status, `Grok HTTP ${res.status}`);
    }
    const data = JSON.parse(new TextDecoder().decode(await readBoundedBody(res, 128 * 1024, signal)));
    return { text: extractOutputText(data), model: typeof data?.model === "string" ? data.model : model };
  };
}
