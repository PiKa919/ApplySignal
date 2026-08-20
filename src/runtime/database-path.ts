import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

export interface DatabasePathOptions {
  liveOnly: boolean;
  bundledPath?: string;
}

/**
 * Keep a stale platform environment override from replacing the shipped live
 * snapshot with a newly-created empty SQLite file in production.
 */
export function resolveDatabasePath(configuredPath: string, options: DatabasePathOptions): string {
  const bundledPath = options.bundledPath ?? "/app/data/applysignal.db";
  if (!options.liveOnly || configuredPath === bundledPath || !existsSync(bundledPath)) return configuredPath;

  try {
    const db = new Database(configuredPath, { readonly: true });
    const row = db.query("SELECT COUNT(*) AS count FROM job_observations WHERE data_mode = 'live'").get() as { count?: number } | null;
    db.close();
    if ((row?.count ?? 0) > 0) return configuredPath;
  } catch {
    // Missing, empty, or pre-schema configured databases should use the live image snapshot.
  }

  return bundledPath;
}
