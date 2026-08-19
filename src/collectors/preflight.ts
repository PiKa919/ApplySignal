export type PreflightStatus = "reachable" | "blocked" | "unexpected_host" | "http_error" | "unreachable" | "invalid_url";

export interface PublicSourcePreflightRequest {
  sourceId: string;
  targetUrl: string;
  expectedHost?: string;
  timeoutMs?: number;
}

export interface PublicSourcePreflightResult {
  sourceId: string;
  targetUrl: string;
  status: PreflightStatus;
  navigationSucceeded: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  finalHost: string | null;
  contentType: string | null;
  bodyBytes: number;
  blockIndicators: string[];
  error?: string;
  brightDataCalls: 0;
  checkedAt: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const BLOCK_PATTERNS = [
  ["access denied", /access\s+denied/i],
  ["captcha", /captcha/i],
  ["cloudflare challenge", /cloudflare\s+(?:ray\s+id|challenge|verification)/i],
  ["verify you are human", /verify\s+you\s+are\s+human/i],
  ["robot check", /(?:robot|bot)\s+check/i],
  ["unusual traffic", /unusual\s+traffic/i],
] as const;

const baseResult = (request: PublicSourcePreflightRequest): PublicSourcePreflightResult => ({
  sourceId: request.sourceId,
  targetUrl: request.targetUrl,
  status: "unreachable",
  navigationSucceeded: false,
  httpStatus: null,
  finalUrl: null,
  finalHost: null,
  contentType: null,
  bodyBytes: 0,
  blockIndicators: [],
  brightDataCalls: 0,
  checkedAt: new Date().toISOString(),
});

export async function preflightPublicSource(request: PublicSourcePreflightRequest, fetcher: FetchLike = fetch): Promise<PublicSourcePreflightResult> {
  const result = baseResult(request);
  let target: URL;
  try {
    target = new URL(request.targetUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("URL must use http or https");
  } catch (error) {
    return { ...result, status: "invalid_url", error: error instanceof Error ? error.message : String(error) };
  }

  try {
    const response = await fetcher(target.toString(), { redirect: "follow", signal: AbortSignal.timeout(request.timeoutMs ?? 15000) });
    const finalUrl = response.url || target.toString();
    const final = new URL(finalUrl);
    const body = await response.arrayBuffer();
    const bodyText = new TextDecoder().decode(body).slice(0, 250_000);
    const visibleText = bodyText
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const blockIndicators = BLOCK_PATTERNS.filter(([, pattern]) => pattern.test(visibleText)).map(([label]) => label);
    const hostMatches = !request.expectedHost || final.host === request.expectedHost;
    const status: PreflightStatus = !hostMatches
      ? "unexpected_host"
      : blockIndicators.length > 0
        ? "blocked"
        : response.ok
          ? "reachable"
          : "http_error";
    return {
      ...result,
      status,
      navigationSucceeded: true,
      httpStatus: response.status,
      finalUrl,
      finalHost: final.host,
      contentType: response.headers.get("content-type"),
      bodyBytes: body.byteLength,
      blockIndicators,
    };
  } catch (error) {
    return { ...result, status: "unreachable", error: error instanceof Error ? error.message : String(error) };
  }
}
