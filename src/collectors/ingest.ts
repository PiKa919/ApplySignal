import { normalizeJobObservation } from "../domain/normalize";
import { createDatabase } from "../storage/database";
import { saveObservation, saveScrapeRun } from "../storage/repository";
import { saveApplicationFields } from "../storage/repository";
import { RECIPROCITY_CATEGORIES, type ApplicationFieldObservation, type ReciprocityCategory } from "../domain/reciprocity";
import type { Database } from "bun:sqlite";
import type { CollectorRunResult } from "./brightdata";
import type { RawJobRow } from "../domain/observations";
import { assessCollectorRows, type CollectorHealthReport } from "./health";

export interface IngestSummary {
  runId: string;
  sourceId: string;
  observationIds: string[];
  rowCount: number;
  dataMode: "live" | "fixture";
}

export function expandCollectorRows(rows: Record<string, unknown>[]): RawJobRow[] {
  const nested = rows.flatMap((row) => Array.isArray(row.jobs) ? row.jobs.filter((job): job is RawJobRow => typeof job === "object" && job !== null) : []);
  const candidates = nested.length > 0 ? nested : rows as RawJobRow[];
  const seen = new Set<string>();
  return candidates.filter((row) => {
    const identity = [row.url, row.job_detail_url, row.product_page_url, row.source_job_id, row.job_id]
      .find((value) => typeof value === "string" && value.trim().length > 0);
    const key = String(identity ?? JSON.stringify(row));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ingestCollectorResult(db: Database, result: CollectorRunResult, dataMode: "live" | "fixture" = "live"): IngestSummary {
  const rows = expandCollectorRows(result.rows);
  const health = assessCollectorRows(rows, { minimumRows: result.expectedMinimumRows, requiredFields: result.requiredFields, identityField: result.identityField, expectedHost: result.expectedHost, minimumCoverage: result.minimumCoverage });
  const run = (status: string, report: CollectorHealthReport = health) => saveScrapeRun(db, { runId: result.runId, collectorId: result.collectorId, sourceId: result.sourceId, observedAt: result.observedAt, status, rowCount: rows.length, expectedMinimumRows: result.expectedMinimumRows, healthStatus: report.status, healthReport: report, rawOutput: result.rawOutput });
  if (result.status !== "success") {
    run("failed", { ...health, status: "quarantined", errors: [...health.errors, result.stderr || "collector failed"] });
    throw new Error(`collector failed: ${result.stderr || "unknown Bright Data error"}`);
  }
  if (rows.length < result.expectedMinimumRows) {
    run("cardinality_failed");
    throw new Error(`cardinality check failed: expected at least ${result.expectedMinimumRows}, received ${rows.length}`);
  }
  if (health.status === "quarantined") {
    run("quarantined");
    throw new Error(`collector quarantined: ${health.errors.join("; ")}`);
  }
  run(result.status);
  const observationIds = rows.map((row) => {
    const observation = normalizeJobObservation(row, { sourceId: result.sourceId, sourceUrl: result.sourceUrl ?? String(row.source_url ?? ""), observedAt: result.observedAt });
    saveObservation(db, { ...observation, dataMode });
    return observation.observationId;
  });
  return { runId: result.runId, sourceId: result.sourceId, observationIds, rowCount: rows.length, dataMode };
}

export function createFixtureDatabase(path = ":memory:"): Database {
  return createDatabase(path);
}

interface RawApplicationField {
  field_label?: string;
  normalized_category?: string;
  is_required?: boolean | null;
}

const isCategory = (value: string): value is ReciprocityCategory => (RECIPROCITY_CATEGORIES as readonly string[]).includes(value);

export function ingestApplicationFields(db: Database, observationId: string, payload: { application_form_fields?: RawApplicationField[] }): number {
  const fields: ApplicationFieldObservation[] = (payload.application_form_fields ?? [])
    .filter((field): field is RawApplicationField & { field_label: string; normalized_category: string } => Boolean(field.field_label && field.normalized_category && isCategory(field.normalized_category)))
    .map((field) => ({ label: field.field_label, category: field.normalized_category as ReciprocityCategory, required: field.is_required ?? null }));
  saveApplicationFields(db, observationId, fields);
  return fields.length;
}
