export interface CollectorHealthContract {
  minimumRows: number;
  requiredFields?: string[];
  identityField?: string;
  urlField?: string;
  expectedHost?: string;
  minimumCoverage?: number;
  scopeKind?: "all_jobs" | "subset" | "talent_pool";
  emptyStateVerified?: boolean;
  pagination?: PaginationHealthEvidence;
  transport?: TransportHealthEvidence;
}

export interface PaginationHealthEvidence {
  expectedPages?: number;
  observedPages?: number;
  repeatedPageCount?: number;
  terminalPageReached?: boolean;
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
  distributions: Record<string, Record<string, number>>;
  duplicateIdentityCount: number;
  duplicateUrlCount: number;
  unexpectedHostCount: number;
  semanticErrorCount: number;
  paginationErrors: string[];
  transportStatus: "unknown" | "healthy" | "quarantined";
  transportErrors: string[];
  errors: string[];
}

export interface DistributionalHealthSnapshot {
  recordCount: number;
  fieldCoverage: Record<string, number>;
  distributions?: Record<string, Record<string, number>>;
}

export interface DistributionalDimensionChange {
  maxAbsoluteDelta: number;
  deltas: Record<string, number>;
}

export interface DistributionalHealthComparison {
  status: "stable" | "changed";
  anomalies: string[];
  requiresReview: boolean;
  automaticHeal: false;
  recordCountDeltaRatio: number | null;
  fieldCoverageDelta: Record<string, number>;
  distributionChanges: Record<string, DistributionalDimensionChange>;
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
const DISTRIBUTION_FIELDS = ["location", "department", "employment_type", "career_stage", "workplace_mode"] as const;
const numericValue = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[,$₹€£\s]/g, "");
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
};

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
  const distributions = Object.fromEntries(DISTRIBUTION_FIELDS.map((field) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!present(row[field])) continue;
      const value = String(row[field]).trim();
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [field, Object.fromEntries([...counts.entries()].map(([value, count]) => [value, rows.length === 0 ? 0 : count / rows.length]))];
  }).filter(([, distribution]) => Object.keys(distribution as Record<string, number>).length > 0));
  const minimumCoverage = contract.minimumCoverage ?? 1;
  for (const [field, coverage] of Object.entries(fieldCoverage)) {
    if (coverage < minimumCoverage) errors.push(`field coverage below threshold: ${field}`);
  }

  const identities = contract.identityField ? rows.map((row) => row[contract.identityField!]).filter(present).map(String) : [];
  const uniqueIdentities = new Set(identities);
  const duplicateIdentityCount = identities.length - uniqueIdentities.size;
  if (duplicateIdentityCount > 0) errors.push("duplicate identity values detected");

  const urls = contract.urlField ? rows.map((row) => row[contract.urlField!]).filter(present).map(String) : [];
  const uniqueUrls = new Set(urls);
  const duplicateUrlCount = urls.length - uniqueUrls.size;
  if (duplicateUrlCount > 0) errors.push("duplicate URL values detected");

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
    const salaryMin = numericValue(row.salary_min);
    const salaryMax = numericValue(row.salary_max);
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      errors.push("salary minimum exceeds salary maximum");
      semanticErrorCount += 1;
    }
  }

  const paginationErrors: string[] = [];
  const pagination = contract.pagination;
  if (pagination?.expectedPages !== undefined && (pagination.observedPages ?? 0) < pagination.expectedPages) paginationErrors.push("pagination stopped before the expected page count");
  if (pagination?.repeatedPageCount !== undefined && pagination.repeatedPageCount > 0) paginationErrors.push("pagination repeated a page");
  if (pagination?.terminalPageReached === false) paginationErrors.push("pagination did not reach a terminal page");
  errors.push(...paginationErrors);

  if (rows.length === 0 && contract.scopeKind === "all_jobs" && contract.emptyStateVerified !== true) errors.push("empty all_jobs scope without verified empty state");

  return { status: errors.length === 0 ? "healthy" : "quarantined", recordCount: rows.length, fieldCoverage, distributions, duplicateIdentityCount, duplicateUrlCount, unexpectedHostCount, semanticErrorCount, paginationErrors, transportStatus: !transport ? "unknown" : transportErrors.length > 0 ? "quarantined" : "healthy", transportErrors, errors };
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
  const distributionChanges: Record<string, DistributionalDimensionChange> = {};
  const dimensions = new Set([...Object.keys(current.distributions ?? {}), ...Object.keys(baseline.distributions ?? {})]);
  for (const dimension of dimensions) {
    const currentDistribution = current.distributions?.[dimension] ?? {};
    const baselineDistribution = baseline.distributions?.[dimension] ?? {};
    const categories = new Set([...Object.keys(currentDistribution), ...Object.keys(baselineDistribution)]);
    const deltas = Object.fromEntries([...categories].map((category) => [category, (currentDistribution[category] ?? 0) - (baselineDistribution[category] ?? 0)]));
    const maxAbsoluteDelta = Math.max(0, ...Object.values(deltas).map((delta) => Math.abs(delta)));
    distributionChanges[dimension] = { maxAbsoluteDelta, deltas };
    if (maxAbsoluteDelta >= 0.25) anomalies.push(`distribution changed materially: ${dimension}`);
  }
  return { status: anomalies.length === 0 ? "stable" : "changed", anomalies, requiresReview: anomalies.length > 0, automaticHeal: false, recordCountDeltaRatio, fieldCoverageDelta, distributionChanges };
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export function buildHealDiagnosis(input: HealDiagnosisInput): HealDiagnosis {
  const comparison = compareDistributionalHealth(input.current, input.baseline);
  const changedFields = Object.entries(comparison.fieldCoverageDelta)
    .filter(([, delta]) => Math.abs(delta) >= 0.25)
    .map(([field]) => field);
  const changedDistributions = Object.entries(comparison.distributionChanges)
    .filter(([, change]) => change.maxAbsoluteDelta >= 0.25)
    .map(([dimension]) => dimension);
  const changedSignals = [...new Set([...changedFields, ...changedDistributions])];
  if (!comparison.requiresReview) {
    return { status: "no_action", collectorId: input.collectorId, sourceId: input.sourceId, changedFields: [], reasons: [], prompt: null, automaticHeal: false };
  }

  const recordReason = comparison.recordCountDeltaRatio !== null && comparison.recordCountDeltaRatio < 0
    ? `record count changed from ${input.baseline.recordCount} to ${input.current.recordCount}`
    : null;
  const fieldReasons = changedFields.map((field) => `field ${field} coverage changed from ${percent(input.baseline.fieldCoverage[field] ?? 0)} to ${percent(input.current.fieldCoverage[field] ?? 0)}`);
  const distributionReasons = changedDistributions.map((dimension) => `distribution ${dimension} changed materially`);
  const reasons = [recordReason, ...fieldReasons, ...distributionReasons].filter((reason): reason is string => Boolean(reason));
  const prompt = [
    `Collector ${input.collectorId} for source ${input.sourceId} requires review before healing.`,
    `Observed extraction drift: ${reasons.join("; ")}.`,
    `Restore the affected fields while you preserve the existing output schema and healthy title/identity extraction.`,
    `Return a preview for validation; do not approve or rerun automatically. Human approval is required after semantic and cardinality checks.`,
  ].join(" ");
  return { status: "review_required", collectorId: input.collectorId, sourceId: input.sourceId, changedFields: changedSignals, reasons, prompt, automaticHeal: false };
}
