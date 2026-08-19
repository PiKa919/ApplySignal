export interface CollectorRequest {
  collectorId: string;
  sourceId: string;
  sourceUrl?: string;
  url?: string;
  expectedMinimumRows?: number;
  requiredFields?: string[];
  identityField?: string;
  urlField?: string;
  expectedHost?: string;
  minimumCoverage?: number;
  scopeKind?: "all_jobs" | "subset" | "talent_pool";
  emptyStateVerified?: boolean;
  pagination?: import("./health").PaginationHealthEvidence;
}

export interface CollectorTransportEvidence {
  navigationSucceeded?: boolean;
  httpStatus?: number;
  finalUrl?: string;
  contentType?: string;
  bodyBytes?: number;
  blocked?: boolean;
}

export interface CollectorRunResult {
  runId: string;
  collectorId: string;
  sourceId: string;
  sourceUrl?: string;
  observedAt: string;
  status: "success" | "failed";
  rawOutput: string;
  stderr: string;
  rows: Record<string, unknown>[];
  expectedMinimumRows: number;
  requiredFields?: string[];
  identityField?: string;
  urlField?: string;
  expectedHost?: string;
  minimumCoverage?: number;
  scopeKind?: "all_jobs" | "subset" | "talent_pool";
  emptyStateVerified?: boolean;
  pagination?: import("./health").PaginationHealthEvidence;
  transport?: CollectorTransportEvidence;
}

export async function runBrightDataCollector(request: CollectorRequest): Promise<CollectorRunResult> {
  const observedAt = new Date().toISOString();
  const args = ["scraper", "run", request.collectorId];
  if (request.url) args.push(request.url);
  args.push("--pretty");
  const process = Bun.spawn(["brightdata", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  let rows: Record<string, unknown>[] = [];
  if (exitCode === 0) {
    try {
      const parsed: unknown = JSON.parse(stdout);
      rows = Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [parsed as Record<string, unknown>];
    } catch {
    return { runId: `run_${Date.now()}`, collectorId: request.collectorId, sourceId: request.sourceId, sourceUrl: request.sourceUrl, observedAt, status: "failed", rawOutput: stdout, stderr: `${stderr}\nBright Data output was not valid JSON.`, rows: [], expectedMinimumRows: request.expectedMinimumRows ?? 1, requiredFields: request.requiredFields, identityField: request.identityField, urlField: request.urlField, expectedHost: request.expectedHost, minimumCoverage: request.minimumCoverage, scopeKind: request.scopeKind, emptyStateVerified: request.emptyStateVerified, pagination: request.pagination };
    }
  }
  return { runId: `run_${Date.now()}`, collectorId: request.collectorId, sourceId: request.sourceId, sourceUrl: request.sourceUrl, observedAt, status: exitCode === 0 ? "success" : "failed", rawOutput: stdout, stderr, rows, expectedMinimumRows: request.expectedMinimumRows ?? 1, requiredFields: request.requiredFields, identityField: request.identityField, urlField: request.urlField, expectedHost: request.expectedHost, minimumCoverage: request.minimumCoverage, scopeKind: request.scopeKind, emptyStateVerified: request.emptyStateVerified, pagination: request.pagination };
}
