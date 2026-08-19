import type {
  DateQuality,
  JobObservation,
  JobProvenance,
  NormalizationContext,
  RawJobRow,
  ProvenanceValue,
} from "./observations";

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

const url = (value: unknown): string | null => {
  const normalized = text(value);
  if (!normalized) return null;
  try {
    return new URL(normalized).toString();
  } catch {
    return normalized;
  }
};

const dateValue = (value: unknown): { value: string | null; quality: DateQuality; provenance: ProvenanceValue } => {
  const raw = text(value);
  if (!raw) return { value: null, quality: "unavailable", provenance: { kind: "unknown" } };
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.valueOf()) && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return { value: parsed.toISOString().slice(0, 10), quality: "exact", provenance: { raw, kind: "exact" } };
  }
  if (/\b(?:day|days|hour|hours|week|weeks|month|months)\b/i.test(raw)) {
    return { value: null, quality: "relative", provenance: { raw, kind: "relative" } };
  }
  return { value: null, quality: "unavailable", provenance: { raw, kind: "relative" } };
};

const provenanceFor = (value: unknown): ProvenanceValue => {
  const raw = text(value);
  return raw ? { raw, kind: "exact" } : { kind: "unknown" };
};

export function normalizeJobObservation(input: RawJobRow, context: NormalizationContext): JobObservation {
  const posted = dateValue(input.posted_date);
  const closing = dateValue(input.closing_date);
  const sourceJobId = text(input.source_job_id);
  const title = text(input.title);
  const location = text(input.location);
  const employmentType = text(input.employment_type);
  const description = text(input.description);
  const salary = text(input.salary);
  const applicationUrl = url(input.application_url);
  const listingUrl = url(input.url);
  const provenance: JobProvenance = {
    sourceJobId: provenanceFor(input.source_job_id),
    title: provenanceFor(input.title),
    location: provenanceFor(input.location),
    employmentType: provenanceFor(input.employment_type),
    postedDate: posted.provenance,
    closingDate: closing.provenance,
    description: provenanceFor(input.description),
    salary: provenanceFor(input.salary),
    applicationUrl: provenanceFor(input.application_url),
    url: provenanceFor(input.url),
  };

  const fingerprint = [context.sourceId, sourceJobId, title, location, listingUrl, context.observedAt].join("|");
  const observationId = `obs_${new Bun.CryptoHasher("sha256").update(fingerprint).digest("hex").slice(0, 16)}`;
  const available = Object.values(provenance).filter((entry) => entry.kind !== "unknown").length;

  return {
    observationId,
    sourceId: context.sourceId,
    sourceUrl: context.sourceUrl,
    observedAt: context.observedAt,
    sourceJobId,
    title,
    location,
    employmentType,
    postedDate: posted.value,
    postedDateQuality: posted.quality,
    closingDate: closing.value,
    closingDateQuality: closing.quality,
    description,
    salary,
    applicationUrl,
    url: listingUrl,
    provenance,
    sourceConfidence: Number((available / Object.keys(provenance).length).toFixed(2)),
  };
}
