import { normalizeJobObservation } from "../domain/normalize";
import { ANALYSIS_VERSION, buildObservationAnalysis } from "../domain/analysis";
import { classifyLifecycleState, diffObservations, inferPostingRelationship } from "../domain/lifecycle";
import { createDatabase } from "../storage/database";
import { listApplicationFields, listLatestObservations, saveAnalysisSnapshot, saveApplicationFields, saveApplicationObservation, saveInference, saveObservation, savePostingEvent, saveScrapeRun } from "../storage/repository";
import { RECIPROCITY_CATEGORIES, type ApplicationFieldObservation, type ReciprocityCategory } from "../domain/reciprocity";
import { summarizeApplicationObservation, type ApplicationFieldSignal } from "../domain/application";
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
  const health = assessCollectorRows(rows, { minimumRows: result.expectedMinimumRows, requiredFields: result.requiredFields, identityField: result.identityField, urlField: result.urlField, expectedHost: result.expectedHost, minimumCoverage: result.minimumCoverage, scopeKind: result.scopeKind, emptyStateVerified: result.emptyStateVerified, pagination: result.pagination, transport: result.transport });
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
    const history = listLatestObservations(db, result.sourceId);
    const exactPrevious = history
      .filter((candidate) => candidate.observationId !== observation.observationId && candidate.observedAt <= observation.observedAt)
      .filter((candidate) => (observation.sourceJobId && candidate.sourceJobId === observation.sourceJobId) || (observation.url && candidate.url === observation.url))[0] ?? null;
    const inferredPrevious = exactPrevious ?? history.find((candidate) => candidate.observationId !== observation.observationId && candidate.observedAt <= observation.observedAt && inferPostingRelationship(candidate, observation) !== null) ?? null;
    const lifecycleState = classifyLifecycleState({ current: observation, previous: inferredPrevious });
    const inference = inferredPrevious && !exactPrevious ? inferPostingRelationship(inferredPrevious, observation) : null;
    saveObservation(db, { ...observation, dataMode });
    if (inference) saveInference(db, inference);
    savePostingEvent(db, {
      sourceId: observation.sourceId,
      eventType: lifecycleState,
      beforeObservationId: inferredPrevious?.observationId ?? null,
      afterObservationId: observation.observationId,
      observedAt: observation.observedAt,
      evidence: {
        changes: inferredPrevious ? diffObservations(inferredPrevious, observation).changes : [],
        ...(inference ? { inference } : {}),
      },
    });
    saveAnalysisSnapshot(db, {
      snapshotId: `${observation.observationId}:${ANALYSIS_VERSION}`,
      observationId: observation.observationId,
      analysisVersion: ANALYSIS_VERSION,
      generatedAt: observation.observedAt,
      analysis: buildObservationAnalysis(observation, inferredPrevious, listApplicationFields(db, observation.observationId)),
    });
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
  input_type?: string;
  is_attachment?: boolean;
  is_custom_question?: boolean;
}

const isCategory = (value: string): value is ReciprocityCategory => (RECIPROCITY_CATEGORIES as readonly string[]).includes(value);

export function ingestApplicationFields(db: Database, observationId: string, payload: { account_required?: boolean | null; application_form_fields?: RawApplicationField[] }): number {
  const signals: ApplicationFieldSignal[] = (payload.application_form_fields ?? [])
    .filter((field): field is RawApplicationField & { field_label: string; normalized_category: string } => Boolean(field.field_label && field.normalized_category && isCategory(field.normalized_category)))
    .map((field) => ({
      label: field.field_label,
      category: field.normalized_category as ReciprocityCategory,
      required: field.is_required ?? null,
      inputType: field.input_type,
      isAttachment: field.is_attachment,
      isCustomQuestion: field.is_custom_question,
    }));
  const fields: ApplicationFieldObservation[] = signals.map(({ label, category, required }) => ({ label, category, required }));
  saveApplicationFields(db, observationId, fields);
  saveApplicationObservation(db, observationId, summarizeApplicationObservation({ accountRequired: payload.account_required ?? null, fields: signals }));
  const observation = listLatestObservations(db).find((candidate) => candidate.observationId === observationId);
  if (observation) {
    const previous = listLatestObservations(db, observation.sourceId)
      .filter((candidate) => candidate.observationId !== observationId && candidate.observedAt < observation.observedAt)[0] ?? null;
    saveAnalysisSnapshot(db, {
      snapshotId: `${observationId}:${ANALYSIS_VERSION}`,
      observationId,
      analysisVersion: ANALYSIS_VERSION,
      generatedAt: new Date().toISOString(),
      analysis: buildObservationAnalysis(observation, previous, listApplicationFields(db, observationId)),
    });
  }
  return fields.length;
}
