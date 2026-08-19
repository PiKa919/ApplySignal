import { createDatabase } from "../storage/database";
import { SOURCE_CATALOG } from "../domain/source-catalog";
import { listLatestObservations, listScrapeRuns } from "../storage/repository";
import type { Database } from "bun:sqlite";

export interface AuditSummary {
  catalog: number;
  observations: number;
  runs: number;
  activeSources: string[];
  liveObservationSources: string[];
  scopedSources: string[];
  partialSources: string[];
  failedSources: string[];
  unresolvedSources: string[];
}

export function auditDatabase(db: Database): AuditSummary {
  const observations = listLatestObservations(db);
  const activeSources = SOURCE_CATALOG.filter((source) => source.status === "live" || source.status === "live_scoped").map((source) => source.sourceId);
  return {
    catalog: SOURCE_CATALOG.length,
    observations: observations.length,
    runs: listScrapeRuns(db).length,
    activeSources,
    liveObservationSources: [...new Set(observations.filter((observation) => observation.dataMode === "live").map((observation) => observation.sourceId))],
    scopedSources: SOURCE_CATALOG.filter((source) => source.status === "live_scoped").map((source) => source.sourceId),
    partialSources: SOURCE_CATALOG.filter((source) => source.status === "partial").map((source) => source.sourceId),
    failedSources: SOURCE_CATALOG.filter((source) => source.status === "failed_generation").map((source) => source.sourceId),
    unresolvedSources: SOURCE_CATALOG.filter((source) => source.status === "unresolved").map((source) => source.sourceId),
  };
}

if (import.meta.main) {
  const db = createDatabase(process.env.APPLYSIGNAL_DB ?? "data/applysignal.db");
  console.log(JSON.stringify(auditDatabase(db), null, 2));
  db.close();
}
