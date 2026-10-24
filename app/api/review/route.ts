// POST /api/review (owner: B). Thin wrapper; logic lives in lib/harness/http.ts.
import { handleReviewPost } from "../../../lib/harness/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleReviewPost(req);
}
