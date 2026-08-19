import type { Database } from "bun:sqlite";
import type { JobObservation } from "../domain/observations";
import type { ApplicationFieldObservation } from "../domain/reciprocity";
import type { PostingInference } from "../domain/lifecycle";

export interface ScrapeRunRecord {
  runId: string;
  collectorId: string;
  sourceId: string;
  observedAt: string;
  status: string;
  rowCount: number;
  expectedMinimumRows: number | null;
  rawOutput: string;
}

export function saveScrapeRun(db: Database, run: ScrapeRunRecord): void {
  const statement = db.query(`INSERT OR REPLACE INTO scrape_runs
    (run_id, collector_id, source_id, observed_at, status, row_count, expected_minimum_rows, raw_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  statement.run(run.runId, run.collectorId, run.sourceId, run.observedAt, run.status, run.rowCount, run.expectedMinimumRows, run.rawOutput);
}

export function saveObservation(db: Database, observation: JobObservation & { dataMode?: "live" | "fixture" }): void {
  const statement = db.query(`INSERT OR REPLACE INTO job_observations
    (observation_id, source_id, source_url, observed_at, source_job_id, title, location, employment_type,
     posted_date, posted_date_quality, closing_date, closing_date_quality, description, salary, application_url,
     url, provenance_json, source_confidence, data_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  statement.run(
    observation.observationId,
    observation.sourceId,
    observation.sourceUrl ?? null,
    observation.observedAt ?? new Date().toISOString(),
    observation.sourceJobId ?? null,
    observation.title ?? null,
    observation.location ?? null,
    observation.employmentType ?? null,
    observation.postedDate ?? null,
    observation.postedDateQuality ?? "unavailable",
    observation.closingDate ?? null,
    observation.closingDateQuality ?? "unavailable",
    observation.description ?? null,
    observation.salary ?? null,
    observation.applicationUrl ?? null,
    observation.url ?? null,
    JSON.stringify(observation.provenance ?? {}),
    observation.sourceConfidence ?? null,
    observation.dataMode ?? "live",
  );
}

interface ObservationRow {
  observation_id: string;
  source_id: string;
  source_url: string | null;
  observed_at: string;
  source_job_id: string | null;
  title: string | null;
  location: string | null;
  employment_type: string | null;
  posted_date: string | null;
  posted_date_quality: JobObservation["postedDateQuality"];
  closing_date: string | null;
  closing_date_quality: JobObservation["closingDateQuality"];
  description: string | null;
  salary: string | null;
  application_url: string | null;
  url: string | null;
  provenance_json: string;
  source_confidence: number | null;
  data_mode: "live" | "fixture";
}

const hydrate = (row: ObservationRow): JobObservation & { dataMode: "live" | "fixture" } => ({
  observationId: row.observation_id,
  sourceId: row.source_id,
  sourceUrl: row.source_url ?? "",
  observedAt: row.observed_at,
  sourceJobId: row.source_job_id,
  title: row.title,
  location: row.location,
  employmentType: row.employment_type,
  postedDate: row.posted_date,
  postedDateQuality: row.posted_date_quality,
  closingDate: row.closing_date,
  closingDateQuality: row.closing_date_quality,
  description: row.description,
  salary: row.salary,
  applicationUrl: row.application_url,
  url: row.url,
  provenance: JSON.parse(row.provenance_json),
  sourceConfidence: row.source_confidence,
  dataMode: row.data_mode,
});

export function listLatestObservations(db: Database, sourceId?: string): Array<JobObservation & { dataMode: "live" | "fixture" }> {
  const rows = sourceId
    ? db.query("SELECT * FROM job_observations WHERE source_id = ? ORDER BY observed_at DESC").all(sourceId)
    : db.query("SELECT * FROM job_observations ORDER BY observed_at DESC").all();
  return (rows as ObservationRow[]).map(hydrate);
}

export function saveApplicationFields(db: Database, observationId: string, fields: ApplicationFieldObservation[]): void {
  const insert = db.query("INSERT INTO application_fields (observation_id, label, category, required) VALUES ($observationId, $label, $category, $required)");
  for (const field of fields) insert.run({ observationId, label: field.label, category: field.category, required: field.required === null ? null : Number(field.required) });
}

export function saveInference(db: Database, inference: PostingInference): void {
  db.query("INSERT INTO posting_inferences (type, confidence, signals_json, observation_ids_json) VALUES ($type, $confidence, $signals, $observationIds)")
    .run({ type: inference.type, confidence: inference.confidence, signals: JSON.stringify(inference.signals), observationIds: JSON.stringify(inference.observationIds) });
}
