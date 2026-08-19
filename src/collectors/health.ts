export interface CollectorHealthContract {
  minimumRows: number;
  requiredFields?: string[];
  identityField?: string;
  expectedHost?: string;
  minimumCoverage?: number;
}

export interface CollectorHealthReport {
  status: "healthy" | "quarantined";
  recordCount: number;
  fieldCoverage: Record<string, number>;
  duplicateIdentityCount: number;
  unexpectedHostCount: number;
  errors: string[];
}

const present = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim().length > 0;

export function assessCollectorRows(rows: Record<string, unknown>[], contract: CollectorHealthContract): CollectorHealthReport {
  const errors: string[] = [];
  const fieldCoverage = Object.fromEntries((contract.requiredFields ?? []).map((field) => [field, rows.length === 0 ? 0 : rows.filter((row) => present(row[field])).length / rows.length]));
  const minimumCoverage = contract.minimumCoverage ?? 1;
  for (const [field, coverage] of Object.entries(fieldCoverage)) {
    if (coverage < minimumCoverage) errors.push(`field coverage below threshold: ${field}`);
  }

  const identities = contract.identityField ? rows.map((row) => row[contract.identityField!]).filter(present).map(String) : [];
  const uniqueIdentities = new Set(identities);
  const duplicateIdentityCount = identities.length - uniqueIdentities.size;
  if (duplicateIdentityCount > 0) errors.push("duplicate identity values detected");

  const unexpectedHostCount = contract.expectedHost
    ? rows.reduce((count, row) => count + (["url", "job_detail_url", "application_url"].some((field) => {
      const value = row[field];
      if (!present(value)) return false;
      try { return new URL(String(value)).host !== contract.expectedHost; } catch { return true; }
    }) ? 1 : 0), 0)
    : 0;
  if (unexpectedHostCount > 0) errors.push("unexpected URL host detected");
  if (rows.length < contract.minimumRows) errors.push(`record count below minimum: ${rows.length}`);

  return { status: errors.length === 0 ? "healthy" : "quarantined", recordCount: rows.length, fieldCoverage, duplicateIdentityCount, unexpectedHostCount, errors };
}
