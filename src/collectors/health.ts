export interface CollectorHealthContract {
  minimumRows: number;
  requiredFields?: string[];
  identityField?: string;
  expectedHost?: string;
  minimumCoverage?: number;
  transport?: TransportHealthEvidence;
}

export interface TransportHealthEvidence {
  navigationSucceeded?: boolean;
  httpStatus?: number;
  finalUrl?: string;
  contentType?: string;
  bodyBytes?: number;
  blocked?: boolean;
}

export interface CollectorHealthReport {
  status: "healthy" | "quarantined";
  recordCount: number;
  fieldCoverage: Record<string, number>;
  duplicateIdentityCount: number;
  unexpectedHostCount: number;
  semanticErrorCount: number;
  transportStatus: "unknown" | "healthy" | "quarantined";
  transportErrors: string[];
  errors: string[];
}

export interface DistributionalHealthSnapshot {
  recordCount: number;
  fieldCoverage: Record<string, number>;
}

export interface DistributionalHealthComparison {
  status: "stable" | "changed";
  anomalies: string[];
  requiresReview: boolean;
  automaticHeal: false;
  recordCountDeltaRatio: number | null;
  fieldCoverageDelta: Record<string, number>;
}

export interface HealDiagnosis {
  status: "no_action" | "review_required";
  collectorId: string;
  sourceId: string;
  changedFields: string[];
  reasons: string[];
  prompt: string | null;
  automaticHeal: false;
}

export interface HealDiagnosisInput {
  collectorId: string;
  sourceId: string;
  baseline: DistributionalHealthSnapshot;
  current: DistributionalHealthSnapshot;
}

const present = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim().length > 0;
const locationPattern = /\b(?:bengaluru|bangalore|pune|mumbai|hyderabad|delhi|london|remote|india|united states|new york|san francisco)\b/i;
const titlePattern = /\b(?:engineer|developer|designer|manager|scientist|analyst|architect|director|intern|counsel|recruiter)\b/i;

export function assessCollectorRows(rows: Record<string, unknown>[], contract: CollectorHealthContract): CollectorHealthReport {
  const errors: string[] = [];
  const transportErrors: string[] = [];
  const transport = contract.transport;
  if (transport) {
    if (transport.navigationSucceeded === false) transportErrors.push("navigation failed");
    if (transport.httpStatus !== undefined && (transport.httpStatus < 200 || transport.httpStatus >= 400)) transportErrors.push(`unexpected HTTP status: ${transport.httpStatus}`);
    if (transport.finalUrl && contract.expectedHost) {
      try {
        if (new URL(transport.finalUrl).host !== contract.expectedHost) transportErrors.push("unexpected final URL host");
      } catch {
        transportErrors.push("invalid final URL");
      }
    }
    if (transport.bodyBytes !== undefined && transport.bodyBytes <= 0) transportErrors.push("empty response body");
    if (transport.blocked === true) transportErrors.push("block or CAPTCHA indicator detected");
  }
  errors.push(...transportErrors);
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

  return { status: errors.length === 0 ? "healthy" : "quarantined", recordCount: rows.length, fieldCoverage, duplicateIdentityCount, unexpectedHostCount, semanticErrorCount, transportStatus: !transport ? "unknown" : transportErrors.length > 0 ? "quarantined" : "healthy", transportErrors, errors };
}

export function compareDistributionalHealth(current: DistributionalHealthSnapshot, baseline: DistributionalHealthSnapshot): DistributionalHealthComparison {
  const anomalies: string[] = [];
  const recordCountDeltaRatio = baseline.recordCount === 0 ? null : (current.recordCount - baseline.recordCount) / baseline.recordCount;
  if (recordCountDeltaRatio !== null && recordCountDeltaRatio <= -0.25) anomalies.push(`record count dropped by ${Math.round(Math.abs(recordCountDeltaRatio) * 100)}%`);
  const fields = new Set([...Object.keys(current.fieldCoverage), ...Object.keys(baseline.fieldCoverage)]);
  const fieldCoverageDelta = Object.fromEntries([...fields].map((field) => [field, (current.fieldCoverage[field] ?? 0) - (baseline.fieldCoverage[field] ?? 0)]));
  for (const [field, delta] of Object.entries(fieldCoverageDelta)) {
    if (Math.abs(delta) >= 0.25) anomalies.push(`field coverage changed materially: ${field}`);
  }
  return { status: anomalies.length === 0 ? "stable" : "changed", anomalies, requiresReview: anomalies.length > 0, automaticHeal: false, recordCountDeltaRatio, fieldCoverageDelta };
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export function buildHealDiagnosis(input: HealDiagnosisInput): HealDiagnosis {
  const comparison = compareDistributionalHealth(input.current, input.baseline);
  const changedFields = Object.entries(comparison.fieldCoverageDelta)
    .filter(([, delta]) => Math.abs(delta) >= 0.25)
    .map(([field]) => field);
  if (!comparison.requiresReview) {
    return { status: "no_action", collectorId: input.collectorId, sourceId: input.sourceId, changedFields: [], reasons: [], prompt: null, automaticHeal: false };
  }

  const recordReason = comparison.recordCountDeltaRatio !== null && comparison.recordCountDeltaRatio < 0
    ? `record count changed from ${input.baseline.recordCount} to ${input.current.recordCount}`
    : null;
  const fieldReasons = changedFields.map((field) => `field ${field} coverage changed from ${percent(input.baseline.fieldCoverage[field] ?? 0)} to ${percent(input.current.fieldCoverage[field] ?? 0)}`);
  const reasons = [recordReason, ...fieldReasons].filter((reason): reason is string => Boolean(reason));
  const prompt = [
    `Collector ${input.collectorId} for source ${input.sourceId} requires review before healing.`,
    `Observed extraction drift: ${reasons.join("; ")}.`,
    `Restore the affected fields while you preserve the existing output schema and healthy title/identity extraction.`,
    `Return a preview for validation; do not approve or rerun automatically. Human approval is required after semantic and cardinality checks.`,
  ].join(" ");
  return { status: "review_required", collectorId: input.collectorId, sourceId: input.sourceId, changedFields, reasons, prompt, automaticHeal: false };
}
