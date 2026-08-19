export interface CollectorRequest {
  collectorId: string;
  sourceId: string;
  url?: string;
  expectedMinimumRows?: number;
}

export interface CollectorRunResult {
  runId: string;
  collectorId: string;
  sourceId: string;
  observedAt: string;
  status: "success" | "failed";
  rawOutput: string;
  stderr: string;
  rows: Record<string, unknown>[];
  expectedMinimumRows: number;
}

export async function runBrightDataCollector(request: CollectorRequest): Promise<CollectorRunResult> {
  const observedAt = new Date().toISOString();
  const args = ["scraper", "run", request.collectorId];
  if (request.url) args.push(request.url);
  args.push("--format", "json");
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
      return { runId: `run_${Date.now()}`, collectorId: request.collectorId, sourceId: request.sourceId, observedAt, status: "failed", rawOutput: stdout, stderr: `${stderr}\nBright Data output was not valid JSON.`, rows: [], expectedMinimumRows: request.expectedMinimumRows ?? 1 };
    }
  }
  return { runId: `run_${Date.now()}`, collectorId: request.collectorId, sourceId: request.sourceId, observedAt, status: exitCode === 0 ? "success" : "failed", rawOutput: stdout, stderr, rows, expectedMinimumRows: request.expectedMinimumRows ?? 1 };
}
