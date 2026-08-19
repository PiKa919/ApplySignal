import type { JobObservation } from "./observations";

export type FreshnessPrecision = "exact" | "lower_bound" | "unknown";

export interface FreshnessAnalysis {
  precision: FreshnessPrecision;
  sourcePublishedText: string | null;
  sourcePublishedAt: string | null;
  ageDays: number | null;
  ageMinDays: number | null;
  firstSeenAt: string;
  label: string;
}

const rawPostedText = (job: JobObservation): string | null => {
  const value = job.provenance.postedDate;
  return value && "raw" in value ? value.raw : null;
};

const lowerBoundDays = (raw: string): number | null => {
  const match = raw.match(/(\d+)\s*\+?\s*(hour|hours|day|days|week|weeks|month|months)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("hour")) return 0;
  if (unit.startsWith("week")) return amount * 7;
  if (unit.startsWith("month")) return amount * 30;
  return amount;
};

export function analyzeFreshness(job: JobObservation): FreshnessAnalysis {
  const sourcePublishedText = rawPostedText(job);
  if (job.postedDateQuality === "exact" && job.postedDate) {
    const publishedMs = Date.parse(`${job.postedDate}T00:00:00.000Z`);
    const observedMs = Date.parse(job.observedAt);
    const ageDays = Number.isNaN(publishedMs) || Number.isNaN(observedMs)
      ? null
      : Math.max(0, Math.floor((observedMs - publishedMs) / 86_400_000));
    return {
      precision: "exact",
      sourcePublishedText,
      sourcePublishedAt: job.postedDate,
      ageDays,
      ageMinDays: null,
      firstSeenAt: job.observedAt,
      label: ageDays === null ? `Source date: ${job.postedDate}` : `Source date: ${job.postedDate} · ${ageDays} days old when observed`,
    };
  }

  if (job.postedDateQuality === "relative" && sourcePublishedText) {
    const ageMinDays = lowerBoundDays(sourcePublishedText);
    return {
      precision: "lower_bound",
      sourcePublishedText,
      sourcePublishedAt: null,
      ageDays: null,
      ageMinDays,
      firstSeenAt: job.observedAt,
      label: ageMinDays === null ? `Source says: ${sourcePublishedText}` : `Source says: ${sourcePublishedText} · at least ${ageMinDays} days old`,
    };
  }

  return {
    precision: "unknown",
    sourcePublishedText,
    sourcePublishedAt: null,
    ageDays: null,
    ageMinDays: null,
    firstSeenAt: job.observedAt,
    label: "Source publish date unknown; first-seen time is recorded separately",
  };
}
