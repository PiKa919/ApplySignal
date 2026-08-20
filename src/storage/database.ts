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
  status TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  note TEXT NOT NULL
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
  source_id TEXT NOT NULL,
  source_url TEXT,
  observed_at TEXT NOT NULL,
  source_job_id TEXT,
  title TEXT,
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
`;

export function createDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec(schema);
  const sourceStatement = db.query(`INSERT INTO sources
    (source_id, name, url, status, role, scope_json, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      status = excluded.status,
      role = excluded.role,
      scope_json = excluded.scope_json,
      note = excluded.note`);
  for (const source of SOURCE_CATALOG) {
    sourceStatement.run(source.sourceId, source.name, source.url, source.status, source.role, JSON.stringify(source.scope), source.note);
  }
  for (const statement of [
    "ALTER TABLE scrape_runs ADD COLUMN health_status TEXT NOT NULL DEFAULT 'healthy'",
    "ALTER TABLE scrape_runs ADD COLUMN health_report TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE job_observations ADD COLUMN flags_json TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE scrape_runs ADD COLUMN run_kind TEXT NOT NULL DEFAULT 'listing'",
  ]) {
    try { db.exec(statement); } catch (error) {
      if (!String(error).includes("duplicate column name")) throw error;
    }
  }
  return db;
}
