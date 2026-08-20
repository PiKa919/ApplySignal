import { createDatabase } from "../storage/database";
import { ingestApplicationFields } from "../collectors/ingest";
import { runBrightDataCollector, type CollectorRequest, type CollectorRunResult } from "../collectors/brightdata";
import { listScrapeRuns, saveScrapeRun } from "../storage/repository";
import { shouldSkipPaidRun } from "../collectors/policy";

export type ApplicationCollectorEnvironment = Record<string, string | undefined>;

export interface ApplicationCollectorRequest extends CollectorRequest {
  observationId: string;
  runKind: "application";
}

export function applicationRequestFromEnv(env: ApplicationCollectorEnvironment): ApplicationCollectorRequest {
  const collectorId = env.BRIGHTDATA_APPLICATION_COLLECTOR_ID;
  const sourceId = env.BRIGHTDATA_APPLICATION_SOURCE_ID;
  const targetUrl = env.BRIGHTDATA_APPLICATION_TARGET_URL;
  const observationId = env.BRIGHTDATA_APPLICATION_OBSERVATION_ID;
  if (!collectorId) throw new Error("BRIGHTDATA_APPLICATION_COLLECTOR_ID is required");
  if (!sourceId) throw new Error("BRIGHTDATA_APPLICATION_SOURCE_ID is required");
  if (!targetUrl) throw new Error("BRIGHTDATA_APPLICATION_TARGET_URL is required");
  if (!observationId) throw new Error("BRIGHTDATA_APPLICATION_OBSERVATION_ID is required");
  return { collectorId, sourceId, sourceUrl: targetUrl, url: targetUrl, observationId, expectedMinimumRows: 1, runKind: "application" };
}

function saveApplicationRun(db: Parameters<typeof saveScrapeRun>[0], request: ApplicationCollectorRequest, result: CollectorRunResult, status: string, rowCount: number, healthStatus: "healthy" | "quarantined" = "healthy"): void {
  saveScrapeRun(db, {
    runId: result.runId,
    collectorId: request.collectorId,
    sourceId: request.sourceId,
    runKind: request.runKind,
    observedAt: result.observedAt,
    status,
    rowCount,
    expectedMinimumRows: request.expectedMinimumRows ?? 1,
    healthStatus,
    healthReport: healthStatus === "quarantined" ? { errors: ["application form metadata was empty or invalid"] } : {},
    rawOutput: "[redacted: public application metadata only]",
  });
}

export async function runApplicationCollectorFromEnv(env: ApplicationCollectorEnvironment = process.env): Promise<void> {
  const request = applicationRequestFromEnv(env);
  const db = createDatabase(env.APPLYSIGNAL_DB ?? "data/applysignal.db");
  try {
    const cooldownHours = Number(env.BRIGHTDATA_COOLDOWN_HOURS ?? "24");
    if (!Number.isFinite(cooldownHours) || cooldownHours < 0) throw new Error("BRIGHTDATA_COOLDOWN_HOURS must be a non-negative number");
    const decision = shouldSkipPaidRun(listScrapeRuns(db), request, new Date(), { cooldownHours, force: env.APPLYSIGNAL_FORCE_PAID_RUN === "true" });
    if (decision.skip) {
      console.log(JSON.stringify({ skipped: true, reason: decision.reason, sourceId: request.sourceId, collectorId: request.collectorId, runKind: request.runKind }));
      return;
    }

    const result = await runBrightDataCollector(request);
    if (result.status !== "success") {
      saveApplicationRun(db, request, result, "failed", 0, "quarantined");
      throw new Error(`application collector failed: ${result.stderr || "unknown Bright Data error"}`);
    }
    const payload = result.rows.find((row) => Array.isArray(row.application_form_fields));
    if (!payload) {
      saveApplicationRun(db, request, result, "quarantined", 0, "quarantined");
      throw new Error("application collector returned no public form field metadata");
    }
    const fieldCount = ingestApplicationFields(db, request.observationId, payload as { account_required?: boolean | null; application_form_fields?: unknown[] }, request.url ?? null);
    if (fieldCount === 0) {
      saveApplicationRun(db, request, result, "quarantined", 0, "quarantined");
      throw new Error("application collector returned zero valid public form fields");
    }
    saveApplicationRun(db, request, result, "success", fieldCount);
    console.log(JSON.stringify({ runId: result.runId, collectorId: request.collectorId, sourceId: request.sourceId, observationId: request.observationId, runKind: request.runKind, fieldCount }));
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  try {
    await runApplicationCollectorFromEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
