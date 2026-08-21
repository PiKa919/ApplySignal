import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SOURCE_CATALOG } from "../domain/source-catalog";

const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_family TEXT NOT NULL,
  collector_id TEXT,
  oracle_id TEXT,
  oracle_url TEXT,
  status TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS postings (
  posting_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_posting_key TEXT NOT NULL,
  canonical_url TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  current_state TEXT NOT NULL DEFAULT 'observed',
  UNIQUE(source_id, source_posting_key)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  run_id TEXT PRIMARY KEY,
  collector_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  run_kind TEXT NOT NULL DEFAULT 'listing',
  row_count INTEGER NOT NULL DEFAULT 0,
  expected_minimum_rows INTEGER,
  health_status TEXT NOT NULL DEFAULT 'healthy',
  health_report TEXT NOT NULL DEFAULT '{}',
  raw_output TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_observations (
  observation_id TEXT PRIMARY KEY,
  posting_id TEXT,
  source_id TEXT NOT NULL,
  source_url TEXT,
  observed_at TEXT NOT NULL,
  source_job_id TEXT,
  title TEXT,
  company_name TEXT,
  location TEXT,
  employment_type TEXT,
  posted_date TEXT,
  posted_date_quality TEXT NOT NULL,
  closing_date TEXT,
  closing_date_quality TEXT NOT NULL,
  description TEXT,
  salary TEXT,
  application_url TEXT,
  url TEXT,
  provenance_json TEXT NOT NULL,
  source_confidence REAL,
  flags_json TEXT NOT NULL DEFAULT '{}',
  data_mode TEXT NOT NULL DEFAULT 'live',
  UNIQUE(source_id, observation_id)
);

CREATE TABLE IF NOT EXISTS application_fields (
  field_id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id TEXT NOT NULL REFERENCES job_observations(observation_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  required INTEGER
);

CREATE TABLE IF NOT EXISTS application_observations (
  observation_id TEXT PRIMARY KEY REFERENCES job_observations(observation_id) ON DELETE CASCADE,
  posting_id TEXT,
  form_url TEXT,
  account_gate INTEGER,
  resume_required INTEGER,
  required_field_count INTEGER NOT NULL,
  optional_field_count INTEGER NOT NULL,
  unknown_field_count INTEGER NOT NULL,
  custom_question_count INTEGER NOT NULL,
  long_answer_count INTEGER NOT NULL,
  attachment_count INTEGER NOT NULL,
  manual_history_fields_json TEXT NOT NULL,
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES job_observations(observation_id) ON DELETE CASCADE,
  posting_id TEXT,
  analysis_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  UNIQUE(observation_id, analysis_version)
);

CREATE TABLE IF NOT EXISTS posting_inferences (
  inference_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  confidence REAL NOT NULL,
  signals_json TEXT NOT NULL,
  observation_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lineage_edges (
  edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_posting_id TEXT,
  to_posting_id TEXT,
  from_observation_id TEXT NOT NULL,
  to_observation_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence_json TEXT NOT NULL,
  algorithm_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posting_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  posting_id TEXT,
  before_posting_id TEXT,
  after_posting_id TEXT,
  event_type TEXT NOT NULL,
  before_observation_id TEXT,
  after_observation_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validation_results (
  validation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  oracle_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  scraper_count INTEGER NOT NULL,
  oracle_count INTEGER NOT NULL,
  matched_count INTEGER NOT NULL,
  missing_from_scraper_json TEXT NOT NULL,
  unexpected_in_scraper_json TEXT NOT NULL,
  agreement_rate REAL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS heal_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  collector_id TEXT NOT NULL,
  failed_run_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  generated_prompt TEXT NOT NULL,
  preview_result_json TEXT,
  preview_health_json TEXT,
  approved INTEGER,
  repaired_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_queue (
  queue_id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processing_started_at TEXT,
  completed_at TEXT,
  observation_id TEXT,
  last_error TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}'
);
`;

function backfillPostings(db: Database): void {
  const rows = db.query(`SELECT observation_id, posting_id, source_id, source_job_id, url, observed_at
    FROM job_observations`).all() as Array<{
      observation_id: string;
      posting_id: string | null;
      source_id: string;
      source_job_id: string | null;
      url: string | null;
      observed_at: string;
    }>;
  const insert = db.query(`INSERT INTO postings
    (posting_id, source_id, source_posting_key, canonical_url, first_seen_at, last_seen_at, current_state)
    VALUES (?, ?, ?, ?, ?, ?, 'observed')
    ON CONFLICT(source_id, source_posting_key) DO UPDATE SET
      canonical_url = COALESCE(excluded.canonical_url, postings.canonical_url),
      first_seen_at = CASE WHEN postings.first_seen_at < excluded.first_seen_at THEN postings.first_seen_at ELSE excluded.first_seen_at END,
      last_seen_at = CASE WHEN postings.last_seen_at > excluded.last_seen_at THEN postings.last_seen_at ELSE excluded.last_seen_at END`);
  const update = db.query("UPDATE job_observations SET posting_id = ? WHERE observation_id = ?");
  for (const row of rows) {
    const sourcePostingKey = row.source_job_id ?? row.url ?? row.observation_id;
    const postingId = row.posting_id ?? `${row.source_id}::${sourcePostingKey}`;
    insert.run(postingId, row.source_id, sourcePostingKey, row.url, row.observed_at, row.observed_at);
    if (row.posting_id !== postingId) update.run(postingId, row.observation_id);
  }
}

function backfillStableRelationshipIds(db: Database): void {
  db.exec(`UPDATE application_observations
    SET posting_id = COALESCE(posting_id, (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = application_observations.observation_id)),
        form_url = COALESCE(form_url, (SELECT application_url FROM job_observations WHERE job_observations.observation_id = application_observations.observation_id))
    WHERE posting_id IS NULL OR form_url IS NULL`);
  db.exec(`UPDATE analysis_snapshots
    SET posting_id = (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = analysis_snapshots.observation_id)
    WHERE posting_id IS NULL`);
  db.exec(`UPDATE lineage_edges
    SET from_posting_id = (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = lineage_edges.from_observation_id),
        to_posting_id = (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = lineage_edges.to_observation_id)
    WHERE from_posting_id IS NULL OR to_posting_id IS NULL`);
  db.exec(`UPDATE posting_events
    SET posting_id = (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = posting_events.after_observation_id),
        before_posting_id = (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = posting_events.before_observation_id),
        after_posting_id = (SELECT posting_id FROM job_observations WHERE job_observations.observation_id = posting_events.after_observation_id)
    WHERE posting_id IS NULL OR after_posting_id IS NULL`);
}

export function createDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec(schema);
  for (const statement of [
    "ALTER TABLE scrape_runs ADD COLUMN health_status TEXT NOT NULL DEFAULT 'healthy'",
    "ALTER TABLE scrape_runs ADD COLUMN health_report TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE job_observations ADD COLUMN flags_json TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE job_observations ADD COLUMN company_name TEXT",
    "ALTER TABLE job_observations ADD COLUMN posting_id TEXT",
    "ALTER TABLE scrape_runs ADD COLUMN run_kind TEXT NOT NULL DEFAULT 'listing'",
    "ALTER TABLE sources ADD COLUMN source_family TEXT NOT NULL DEFAULT 'custom'",
    "ALTER TABLE sources ADD COLUMN collector_id TEXT",
    "ALTER TABLE sources ADD COLUMN oracle_id TEXT",
    "ALTER TABLE sources ADD COLUMN oracle_url TEXT",
    "ALTER TABLE application_observations ADD COLUMN posting_id TEXT",
    "ALTER TABLE application_observations ADD COLUMN form_url TEXT",
    "ALTER TABLE analysis_snapshots ADD COLUMN posting_id TEXT",
    "ALTER TABLE lineage_edges ADD COLUMN from_posting_id TEXT",
    "ALTER TABLE lineage_edges ADD COLUMN to_posting_id TEXT",
    "ALTER TABLE posting_events ADD COLUMN posting_id TEXT",
    "ALTER TABLE posting_events ADD COLUMN before_posting_id TEXT",
    "ALTER TABLE posting_events ADD COLUMN after_posting_id TEXT",
  ]) {
    try { db.exec(statement); } catch (error) {
      if (!String(error).includes("duplicate column name")) throw error;
    }
  }
  const sourceStatement = db.query(`INSERT INTO sources
    (source_id, name, url, source_family, collector_id, oracle_id, oracle_url, status, role, scope_json, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      source_family = excluded.source_family,
      collector_id = excluded.collector_id,
      oracle_id = excluded.oracle_id,
      oracle_url = excluded.oracle_url,
      status = excluded.status,
      role = excluded.role,
      scope_json = excluded.scope_json,
      note = excluded.note`);
  for (const source of SOURCE_CATALOG) {
    sourceStatement.run(source.sourceId, source.name, source.url, source.sourceFamily, source.collectorId, source.oracleId, source.oracleUrl, source.status, source.role, JSON.stringify(source.scope), source.note);
  }
  backfillPostings(db);
  backfillStableRelationshipIds(db);
  return db;
}
