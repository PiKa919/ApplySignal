import { createDatabase } from "../storage/database";
import { listScrapeRuns } from "../storage/repository";
import { ingestCollectorResult } from "../collectors/ingest";
import { runBrightDataCollector, type CollectorRequest } from "../collectors/brightdata";
import { shouldSkipPaidRun } from "../collectors/policy";
import { preflightPublicSource, type PublicSourcePreflightRequest, type PublicSourcePreflightResult } from "../collectors/preflight";
import { SOURCE_CATALOG } from "../domain/source-catalog";

export type CollectorEnvironment = Record<string, string | undefined>;

export interface CollectorRunDependencies {
  preflight?: (request: PublicSourcePreflightRequest) => Promise<PublicSourcePreflightResult>;
  runCollector?: typeof runBrightDataCollector;
  log?: (message: string) => void;
}

export function collectorRequestFromEnv(env: CollectorEnvironment): CollectorRequest {
  const collectorId = env.BRIGHTDATA_COLLECTOR_ID;
  const sourceId = env.BRIGHTDATA_SOURCE_ID;
  if (!collectorId) throw new Error("BRIGHTDATA_COLLECTOR_ID is required");
  if (!sourceId) throw new Error("BRIGHTDATA_SOURCE_ID is required");
  const minimum = Number(env.BRIGHTDATA_MIN_ROWS ?? "1");
  if (!Number.isInteger(minimum) || minimum < 0) throw new Error("BRIGHTDATA_MIN_ROWS must be a non-negative integer");
  const requiredFields = (env.BRIGHTDATA_REQUIRED_FIELDS ?? "").split(",").map((field) => field.trim()).filter(Boolean);
  const minimumCoverage = env.BRIGHTDATA_MIN_COVERAGE === undefined || env.BRIGHTDATA_MIN_COVERAGE.trim() === "" ? undefined : Number(env.BRIGHTDATA_MIN_COVERAGE);
  if (minimumCoverage !== undefined && (!Number.isFinite(minimumCoverage) || minimumCoverage < 0 || minimumCoverage > 1)) throw new Error("BRIGHTDATA_MIN_COVERAGE must be between 0 and 1");
  const scopeKind = env.BRIGHTDATA_SCOPE_KIND?.trim() || "all_jobs";
  if (scopeKind && !["all_jobs", "subset", "talent_pool"].includes(scopeKind)) throw new Error("BRIGHTDATA_SCOPE_KIND must be all_jobs, subset, or talent_pool");
  const emptyState = env.BRIGHTDATA_EMPTY_STATE_VERIFIED?.trim();
  if (emptyState && emptyState !== "true" && emptyState !== "false") throw new Error("BRIGHTDATA_EMPTY_STATE_VERIFIED must be true or false");
  return {
    collectorId,
    sourceId,
    sourceUrl: env.BRIGHTDATA_SOURCE_URL,
    url: env.BRIGHTDATA_TARGET_URL,
    expectedMinimumRows: minimum,
    ...(requiredFields.length > 0 ? { requiredFields } : {}),
    ...(env.BRIGHTDATA_IDENTITY_FIELD?.trim() ? { identityField: env.BRIGHTDATA_IDENTITY_FIELD.trim() } : {}),
    ...(env.BRIGHTDATA_URL_FIELD?.trim() ? { urlField: env.BRIGHTDATA_URL_FIELD.trim() } : {}),
    ...(env.BRIGHTDATA_EXPECTED_HOST?.trim() ? { expectedHost: env.BRIGHTDATA_EXPECTED_HOST.trim() } : {}),
    ...(minimumCoverage !== undefined ? { minimumCoverage } : {}),
    scopeKind: scopeKind as CollectorRequest["scopeKind"],
    ...(emptyState ? { emptyStateVerified: emptyState === "true" } : {}),
  };
}

export async function runCollectorFromEnv(env: CollectorEnvironment = process.env, dependencies: CollectorRunDependencies = {}): Promise<void> {
  const request = collectorRequestFromEnv(env);
  const db = createDatabase(env.APPLYSIGNAL_DB ?? "data/applysignal.db");
  const log = dependencies.log ?? console.log;
  const preflight = dependencies.preflight ?? preflightPublicSource;
  const runCollector = dependencies.runCollector ?? runBrightDataCollector;
  try {
    const cooldownHours = Number(env.BRIGHTDATA_COOLDOWN_HOURS ?? "24");
    if (!Number.isFinite(cooldownHours) || cooldownHours < 0) throw new Error("BRIGHTDATA_COOLDOWN_HOURS must be a non-negative number");
    const decision = shouldSkipPaidRun(listScrapeRuns(db), request, new Date(), {
      cooldownHours,
      force: env.APPLYSIGNAL_FORCE_PAID_RUN === "true",
    });
    if (decision.skip) {
      log(JSON.stringify({ skipped: true, reason: decision.reason, sourceId: request.sourceId, collectorId: request.collectorId }));
      return;
    }

    const catalogEntry = SOURCE_CATALOG.find((source) => source.sourceId === request.sourceId);
    if (catalogEntry && ["unresolved", "failed_generation"].includes(catalogEntry.status) && env.APPLYSIGNAL_ALLOW_UNRESOLVED_SOURCE !== "true") {
      log(JSON.stringify({
        skipped: true,
        reason: "source_not_ready",
        sourceId: request.sourceId,
        collectorId: request.collectorId,
        sourceStatus: catalogEntry.status,
        brightDataCalls: 0,
      }));
      return;
    }

    const preflightMode = env.APPLYSIGNAL_PREFLIGHT_MODE ?? "required";
    if (preflightMode !== "required" && preflightMode !== "disabled") {
      throw new Error("APPLYSIGNAL_PREFLIGHT_MODE must be required or disabled");
    }
    if (preflightMode === "disabled") {
      log(JSON.stringify({ sourceId: request.sourceId, collectorId: request.collectorId, preflight: { status: "disabled" } }));
    } else {
      const preflightResult = await preflight({
        sourceId: request.sourceId,
        targetUrl: request.url ?? "",
        ...(request.expectedHost ? { expectedHost: request.expectedHost } : {}),
        timeoutMs: Number(env.APPLYSIGNAL_PREFLIGHT_TIMEOUT_MS ?? "15000"),
      });
      if (preflightResult.status !== "reachable") {
        log(JSON.stringify({
          skipped: true,
          reason: `preflight_${preflightResult.status}`,
          sourceId: request.sourceId,
          collectorId: request.collectorId,
          preflight: preflightResult,
          brightDataCalls: 0,
        }));
        return;
      }
    }

    const result = await runCollector(request);
    log(JSON.stringify(ingestCollectorResult(db, result)));
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  try {
    await runCollectorFromEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
