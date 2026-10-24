// GET /api/health (owner: B). Sanitized capability state; no credentials or account identifiers.
import { handleHealth } from "../../../lib/harness/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handleHealth();
}
