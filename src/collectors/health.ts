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
  semanticErrorCount: number;
  errors: string[];
}

const present = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim().length > 0;
const locationPattern = /\b(?:bengaluru|bangalore|pune|mumbai|hyderabad|delhi|london|remote|india|united states|new york|san francisco)\b/i;
const titlePattern = /\b(?:engineer|developer|designer|manager|scientist|analyst|architect|director|intern|counsel|recruiter)\b/i;

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
  let semanticErrorCount = 0;
  for (const row of rows) {
    if (present(row.title) && locationPattern.test(String(row.title))) {
      errors.push("semantic field swap: title resembles a location");
      semanticErrorCount += 1;
    }
    if (present(row.location) && titlePattern.test(String(row.location))) {
      errors.push("semantic field swap: location resembles a title");
      semanticErrorCount += 1;
    }
    const posted = String(row.posted_date ?? row.posted_date_text ?? "");
    const closing = String(row.closing_date ?? row.closing_date_text ?? "");
    if (/^\d{4}-\d{2}-\d{2}/.test(posted) && /^\d{4}-\d{2}-\d{2}/.test(closing) && new Date(closing).valueOf() < new Date(posted).valueOf()) {
      errors.push("closing date precedes posted date");
      semanticErrorCount += 1;
    }
  }

  return { status: errors.length === 0 ? "healthy" : "quarantined", recordCount: rows.length, fieldCoverage, duplicateIdentityCount, unexpectedHostCount, semanticErrorCount, errors };
}
