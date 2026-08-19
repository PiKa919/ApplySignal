import type { Database } from "bun:sqlite";
import type { JobObservation } from "../domain/observations";
import type { ApplicationFieldObservation } from "../domain/reciprocity";
import type { ApplicationObservationSummary } from "../domain/application";
import type { LifecycleState, PostingInference } from "../domain/lifecycle";
import type { JobIdComparison } from "../domain/validation";
import { classifyPostingFlags } from "../domain/normalize";

const DEFAULT_FLAGS = { explicitEvergreen: false, evergreenLike: false, talentPool: false, multipleOpenings: false } as const;

export interface ScrapeRunRecord {
  runId: string;
  collectorId: string;
  sourceId: string;
  observedAt: string;
  status: string;
  runKind?: "listing" | "application";
  rowCount: number;
  expectedMinimumRows: number | null;
  healthStatus?: "healthy" | "quarantined";
  healthReport?: Record<string, unknown>;
  rawOutput: string;
}

export interface ScrapeRunHealth {
  runId: string;
  collectorId: string;
  sourceId: string;
  observedAt: string;
  status: string;
  runKind: "listing" | "application";
  rowCount: number;
  expectedMinimumRows: number | null;
  healthStatus: "healthy" | "quarantined";
  healthReport: Record<string, unknown>;
}

export function saveScrapeRun(db: Database, run: ScrapeRunRecord): void {
  const statement = db.query(`INSERT OR REPLACE INTO scrape_runs
    (run_id, collector_id, source_id, observed_at, status, run_kind, row_count, expected_minimum_rows, health_status, health_report, raw_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  statement.run(run.runId, run.collectorId, run.sourceId, run.observedAt, run.status, run.runKind ?? "listing", run.rowCount, run.expectedMinimumRows, run.healthStatus ?? "healthy", JSON.stringify(run.healthReport ?? {}), run.rawOutput);
}

export function listScrapeRuns(db: Database): ScrapeRunHealth[] {
  const rows = db.query(`SELECT run_id as runId, collector_id as collectorId, source_id as sourceId,
    observed_at as observedAt, status, run_kind as runKind, row_count as rowCount, expected_minimum_rows as expectedMinimumRows,
    health_status as healthStatus, health_report as healthReport
    FROM scrape_runs ORDER BY observed_at DESC`).all() as Array<ScrapeRunHealth & { healthReport: string | Record<string, unknown> }>;
  return rows.map((row) => ({ ...row, healthReport: typeof row.healthReport === "string" ? JSON.parse(row.healthReport) : row.healthReport }));
}

export function saveObservation(db: Database, observation: JobObservation & { dataMode?: "live" | "fixture" }): void {
  const statement = db.query(`INSERT OR REPLACE INTO job_observations
    (observation_id, source_id, source_url, observed_at, source_job_id, title, location, employment_type,
     posted_date, posted_date_quality, closing_date, closing_date_quality, description, salary, application_url,
     url, provenance_json, source_confidence, flags_json, data_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
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
    JSON.stringify(observation.flags ?? DEFAULT_FLAGS),
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
  flags_json: string;
  data_mode: "live" | "fixture";
}

const hydrate = (row: ObservationRow): JobObservation & { dataMode: "live" | "fixture" } => {
  const storedFlags = { ...DEFAULT_FLAGS, ...JSON.parse(row.flags_json || "{}") };
  const derivedFlags = classifyPostingFlags(row.title, row.description);
  return {
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
  flags: {
    explicitEvergreen: storedFlags.explicitEvergreen || derivedFlags.explicitEvergreen,
    evergreenLike: storedFlags.evergreenLike || derivedFlags.evergreenLike,
    talentPool: storedFlags.talentPool || derivedFlags.talentPool,
    multipleOpenings: storedFlags.multipleOpenings || derivedFlags.multipleOpenings,
  },
  dataMode: row.data_mode,
  };
};

export function listLatestObservations(db: Database, sourceId?: string): Array<JobObservation & { dataMode: "live" | "fixture" }> {
  const rows = sourceId
    ? db.query("SELECT * FROM job_observations WHERE source_id = ? ORDER BY observed_at DESC").all(sourceId)
    : db.query("SELECT * FROM job_observations ORDER BY observed_at DESC").all();
  return (rows as ObservationRow[]).map(hydrate);
}

export function saveApplicationFields(db: Database, observationId: string, fields: ApplicationFieldObservation[]): void {
  const insert = db.query("INSERT INTO application_fields (observation_id, label, category, required) VALUES (?, ?, ?, ?)");
  for (const field of fields) insert.run(observationId, field.label, field.category, field.required === null ? null : Number(field.required));
}

export function listApplicationFields(db: Database, observationId: string): ApplicationFieldObservation[] {
  const rows = db.query("SELECT label, category, required FROM application_fields WHERE observation_id = ? ORDER BY field_id").all(observationId) as Array<{ label: string; category: ApplicationFieldObservation["category"]; required: number | null }>;
  return rows.map((row) => ({ label: row.label, category: row.category, required: row.required === null ? null : row.required === 1 }));
}

export function saveApplicationObservation(db: Database, observationId: string, summary: ApplicationObservationSummary, observedAt = new Date().toISOString()): void {
  db.query(`INSERT OR REPLACE INTO application_observations
    (observation_id, account_gate, resume_required, required_field_count, optional_field_count,
     unknown_field_count, custom_question_count, long_answer_count, attachment_count,
     manual_history_fields_json, observed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      observationId,
      summary.accountGate === null ? null : Number(summary.accountGate),
      summary.resumeRequired === null ? null : Number(summary.resumeRequired),
      summary.requiredFieldCount,
      summary.optionalFieldCount,
      summary.unknownFieldCount,
      summary.customQuestionCount,
      summary.longAnswerCount,
      summary.attachmentCount,
      JSON.stringify(summary.manualHistoryFields),
      observedAt,
    );
}

export function listApplicationObservation(db: Database, observationId: string): ApplicationObservationSummary | null {
  const row = db.query(`SELECT account_gate as accountGate, resume_required as resumeRequired,
    required_field_count as requiredFieldCount, optional_field_count as optionalFieldCount,
    unknown_field_count as unknownFieldCount, custom_question_count as customQuestionCount,
    long_answer_count as longAnswerCount, attachment_count as attachmentCount,
    manual_history_fields_json as manualHistoryFields
    FROM application_observations WHERE observation_id = ?`).get(observationId) as
    | (Omit<ApplicationObservationSummary, "accountGate" | "resumeRequired" | "manualHistoryFields"> & { accountGate: number | null; resumeRequired: number | null; manualHistoryFields: string })
    | null;
  if (!row) return null;
  return {
    accountGate: row.accountGate === null ? null : row.accountGate === 1,
    resumeRequired: row.resumeRequired === null ? null : row.resumeRequired === 1,
    requiredFieldCount: row.requiredFieldCount,
    optionalFieldCount: row.optionalFieldCount,
    unknownFieldCount: row.unknownFieldCount,
    customQuestionCount: row.customQuestionCount,
    longAnswerCount: row.longAnswerCount,
    attachmentCount: row.attachmentCount,
    manualHistoryFields: JSON.parse(row.manualHistoryFields),
  };
}

export interface AnalysisSnapshotRecord {
  snapshotId: string;
  observationId: string;
  analysisVersion: string;
  generatedAt: string;
  analysis: Record<string, unknown>;
}

export function saveAnalysisSnapshot(db: Database, snapshot: AnalysisSnapshotRecord): void {
  db.query(`INSERT INTO analysis_snapshots
    (snapshot_id, observation_id, analysis_version, generated_at, analysis_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(observation_id, analysis_version) DO UPDATE SET
      snapshot_id = excluded.snapshot_id,
      generated_at = excluded.generated_at,
      analysis_json = excluded.analysis_json`)
    .run(snapshot.snapshotId, snapshot.observationId, snapshot.analysisVersion, snapshot.generatedAt, JSON.stringify(snapshot.analysis));
}

export function listAnalysisSnapshots(db: Database, observationId?: string): AnalysisSnapshotRecord[] {
  const rows = observationId
    ? db.query(`SELECT snapshot_id as snapshotId, observation_id as observationId,
      analysis_version as analysisVersion, generated_at as generatedAt, analysis_json as analysis
      FROM analysis_snapshots WHERE observation_id = ? ORDER BY generated_at DESC`).all(observationId)
    : db.query(`SELECT snapshot_id as snapshotId, observation_id as observationId,
      analysis_version as analysisVersion, generated_at as generatedAt, analysis_json as analysis
      FROM analysis_snapshots ORDER BY generated_at DESC`).all();
  return (rows as Array<Omit<AnalysisSnapshotRecord, "analysis"> & { analysis: string }>).map((row) => ({
    ...row,
    analysis: JSON.parse(row.analysis),
  }));
}

export function saveInference(db: Database, inference: PostingInference): void {
  db.query("INSERT INTO posting_inferences (type, confidence, signals_json, observation_ids_json) VALUES (?, ?, ?, ?)")
    .run(inference.type, inference.confidence, JSON.stringify(inference.signals), JSON.stringify(inference.observationIds));
}

export interface PostingEventRecord {
  sourceId: string;
  eventType: LifecycleState;
  beforeObservationId: string | null;
  afterObservationId: string;
  observedAt: string;
  evidence: Record<string, unknown>;
}

export function savePostingEvent(db: Database, event: PostingEventRecord): void {
  db.query(`INSERT INTO posting_events
    (source_id, event_type, before_observation_id, after_observation_id, observed_at, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(event.sourceId, event.eventType, event.beforeObservationId, event.afterObservationId, event.observedAt, JSON.stringify(event.evidence));
}

export function listPostingEvents(db: Database, sourceId?: string): Array<PostingEventRecord & { eventId: number }> {
  const rows = sourceId
    ? db.query(`SELECT event_id as eventId, source_id as sourceId, event_type as eventType,
      before_observation_id as beforeObservationId, after_observation_id as afterObservationId,
      observed_at as observedAt, evidence_json as evidence
      FROM posting_events WHERE source_id = ? ORDER BY event_id DESC`).all(sourceId)
    : db.query(`SELECT event_id as eventId, source_id as sourceId, event_type as eventType,
      before_observation_id as beforeObservationId, after_observation_id as afterObservationId,
      observed_at as observedAt, evidence_json as evidence
      FROM posting_events ORDER BY event_id DESC`).all();
  return (rows as Array<PostingEventRecord & { eventId: number; evidence: string }>).map((row) => ({ ...row, evidence: JSON.parse(row.evidence) }));
}

export function saveValidationResult(db: Database, result: JobIdComparison): void {
  db.query(`INSERT INTO validation_results
    (source_id, oracle_id, checked_at, scraper_count, oracle_count, matched_count,
     missing_from_scraper_json, unexpected_in_scraper_json, agreement_rate, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      result.sourceId,
      result.oracleId,
      result.checkedAt,
      result.scraperCount,
      result.oracleCount,
      result.matchedCount,
      JSON.stringify(result.missingFromScraper),
      JSON.stringify(result.unexpectedInScraper),
      result.agreementRate,
      result.status,
    );
}

export function listValidationResults(db: Database): JobIdComparison[] {
  const rows = db.query(`SELECT source_id, oracle_id, checked_at, scraper_count, oracle_count,
    matched_count, missing_from_scraper_json, unexpected_in_scraper_json, agreement_rate, status
    FROM validation_results ORDER BY checked_at DESC`).all() as Array<{
      source_id: string;
      oracle_id: string;
      checked_at: string;
      scraper_count: number;
      oracle_count: number;
      matched_count: number;
      missing_from_scraper_json: string;
      unexpected_in_scraper_json: string;
      agreement_rate: number | null;
      status: JobIdComparison["status"];
    }>;
  return rows.map((row) => ({
    sourceId: row.source_id,
    oracleId: row.oracle_id,
    checkedAt: row.checked_at,
    scraperCount: row.scraper_count,
    oracleCount: row.oracle_count,
    matchedCount: row.matched_count,
    missingFromScraper: JSON.parse(row.missing_from_scraper_json),
    unexpectedInScraper: JSON.parse(row.unexpected_in_scraper_json),
    agreementRate: row.agreement_rate,
    status: row.status,
  }));
}

export interface HealEventRecord {
  eventId?: number;
  sourceId: string;
  collectorId: string;
  failedRunId: string;
  reason: string;
  generatedPrompt: string;
  previewResult: Record<string, unknown> | null;
  previewHealth: Record<string, unknown> | null;
  approved: boolean | null;
  repairedRunId: string | null;
  createdAt?: string;
}

export function saveHealEvent(db: Database, event: Omit<HealEventRecord, "eventId" | "createdAt">): void {
  db.query(`INSERT INTO heal_events
    (source_id, collector_id, failed_run_id, reason, generated_prompt,
     preview_result_json, preview_health_json, approved, repaired_run_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      event.sourceId,
      event.collectorId,
      event.failedRunId,
      event.reason,
      event.generatedPrompt,
      event.previewResult === null ? null : JSON.stringify(event.previewResult),
      event.previewHealth === null ? null : JSON.stringify(event.previewHealth),
      event.approved === null ? null : Number(event.approved),
      event.repairedRunId,
    );
}

export function listHealEvents(db: Database): HealEventRecord[] {
  const rows = db.query(`SELECT event_id as eventId, source_id as sourceId, collector_id as collectorId,
    failed_run_id as failedRunId, reason, generated_prompt as generatedPrompt,
    preview_result_json as previewResult, preview_health_json as previewHealth,
    approved, repaired_run_id as repairedRunId, created_at as createdAt
    FROM heal_events ORDER BY event_id DESC`).all() as Array<HealEventRecord & {
      previewResult: string | null;
      previewHealth: string | null;
      approved: number | null;
    }>;
  return rows.map((row) => ({
    ...row,
    previewResult: row.previewResult === null ? null : JSON.parse(row.previewResult),
    previewHealth: row.previewHealth === null ? null : JSON.parse(row.previewHealth),
    approved: row.approved === null ? null : row.approved === 1,
  }));
}
