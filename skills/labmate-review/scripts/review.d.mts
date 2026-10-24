// Types for review.mjs so TypeScript tests can import it.
export declare const DEFAULT_BASE_URL: string;
export declare const EXIT: { OK: 0; API_ERROR: 1; USAGE: 2; UNREACHABLE: 3 };
export interface ReviewResult {
  status: number;
  mode: string | null;
  body: any;
}
export declare function plain(value: unknown): string;
export declare function parseArgs(argv: string[]): { file: string | null; url: string; json: boolean; help?: boolean };
export declare function prepareRequest(text: string): Record<string, unknown>;
export declare function requestReview(
  request: unknown,
  options?: { baseUrl?: string; fetchImpl?: (req: Request) => Promise<Response>; timeoutMs?: number },
): Promise<ReviewResult>;
export declare function formatReview(result: ReviewResult): string;
export declare function main(argv?: string[], io?: { log: (s: string) => void; error: (s: string) => void }): Promise<number>;
