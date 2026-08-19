import { createDatabase } from "../storage/database";
import { ingestCollectorResult } from "../collectors/ingest";
import { runBrightDataCollector, type CollectorRequest } from "../collectors/brightdata";

export type CollectorEnvironment = Record<string, string | undefined>;

export function collectorRequestFromEnv(env: CollectorEnvironment): CollectorRequest {
  const collectorId = env.BRIGHTDATA_COLLECTOR_ID;
  const sourceId = env.BRIGHTDATA_SOURCE_ID;
  if (!collectorId) throw new Error("BRIGHTDATA_COLLECTOR_ID is required");
  if (!sourceId) throw new Error("BRIGHTDATA_SOURCE_ID is required");
  const minimum = Number(env.BRIGHTDATA_MIN_ROWS ?? "1");
  if (!Number.isInteger(minimum) || minimum < 0) throw new Error("BRIGHTDATA_MIN_ROWS must be a non-negative integer");
  return { collectorId, sourceId, sourceUrl: env.BRIGHTDATA_SOURCE_URL, url: env.BRIGHTDATA_TARGET_URL, expectedMinimumRows: minimum };
}

if (import.meta.main) {
  try {
    const request = collectorRequestFromEnv(process.env);
    const result = await runBrightDataCollector(request);
    const db = createDatabase(process.env.APPLYSIGNAL_DB ?? "data/applysignal.db");
    const summary = ingestCollectorResult(db, result);
    db.close();
    console.log(JSON.stringify(summary));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
