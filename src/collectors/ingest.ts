import { normalizeJobObservation } from "../domain/normalize";
import { createDatabase } from "../storage/database";
import { saveObservation, saveScrapeRun } from "../storage/repository";
import type { Database } from "bun:sqlite";
import type { CollectorRunResult } from "./brightdata";

export interface IngestSummary {
  runId: string;
  sourceId: string;
  observationIds: string[];
  rowCount: number;
  dataMode: "live" | "fixture";
}

export function ingestCollectorResult(db: Database, result: CollectorRunResult, dataMode: "live" | "fixture" = "live"): IngestSummary {
  if (result.status !== "success") throw new Error(`collector failed: ${result.stderr || "unknown Bright Data error"}`);
  if (result.rows.length < result.expectedMinimumRows) throw new Error(`cardinality check failed: expected at least ${result.expectedMinimumRows}, received ${result.rows.length}`);
  saveScrapeRun(db, { runId: result.runId, collectorId: result.collectorId, sourceId: result.sourceId, observedAt: result.observedAt, status: result.status, rowCount: result.rows.length, expectedMinimumRows: result.expectedMinimumRows, rawOutput: result.rawOutput });
  const observationIds = result.rows.map((row) => {
    const observation = normalizeJobObservation(row, { sourceId: result.sourceId, sourceUrl: String(row.source_url ?? ""), observedAt: result.observedAt });
    saveObservation(db, { ...observation, dataMode });
    return observation.observationId;
  });
  return { runId: result.runId, sourceId: result.sourceId, observationIds, rowCount: result.rows.length, dataMode };
}

export function createFixtureDatabase(path = ":memory:"): Database {
  return createDatabase(path);
}
