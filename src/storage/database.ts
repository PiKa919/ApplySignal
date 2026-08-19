import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scrape_runs (
  run_id TEXT PRIMARY KEY,
  collector_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  status TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS posting_inferences (
  inference_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  confidence REAL NOT NULL,
  signals_json TEXT NOT NULL,
  observation_ids_json TEXT NOT NULL
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
`;

export function createDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec(schema);
  for (const statement of [
    "ALTER TABLE scrape_runs ADD COLUMN health_status TEXT NOT NULL DEFAULT 'healthy'",
    "ALTER TABLE scrape_runs ADD COLUMN health_report TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE job_observations ADD COLUMN flags_json TEXT NOT NULL DEFAULT '{}'",
  ]) {
    try { db.exec(statement); } catch (error) {
      if (!String(error).includes("duplicate column name")) throw error;
    }
  }
  return db;
}
