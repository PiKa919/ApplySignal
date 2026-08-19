import { normalizeJobObservation } from "../domain/normalize";
import { createDatabase } from "../storage/database";
import { saveObservation, saveScrapeRun } from "../storage/repository";
import { saveApplicationFields } from "../storage/repository";
import { RECIPROCITY_CATEGORIES, type ApplicationFieldObservation, type ReciprocityCategory } from "../domain/reciprocity";
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
  const run = (status: string) => saveScrapeRun(db, { runId: result.runId, collectorId: result.collectorId, sourceId: result.sourceId, observedAt: result.observedAt, status, rowCount: result.rows.length, expectedMinimumRows: result.expectedMinimumRows, rawOutput: result.rawOutput });
  if (result.status !== "success") {
    run("failed");
    throw new Error(`collector failed: ${result.stderr || "unknown Bright Data error"}`);
  }
  if (result.rows.length < result.expectedMinimumRows) {
    run("cardinality_failed");
    throw new Error(`cardinality check failed: expected at least ${result.expectedMinimumRows}, received ${result.rows.length}`);
  }
  run(result.status);
  const observationIds = result.rows.map((row) => {
    const observation = normalizeJobObservation(row, { sourceId: result.sourceId, sourceUrl: result.sourceUrl ?? String(row.source_url ?? ""), observedAt: result.observedAt });
    saveObservation(db, { ...observation, dataMode });
    return observation.observationId;
  });
  return { runId: result.runId, sourceId: result.sourceId, observationIds, rowCount: result.rows.length, dataMode };
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
