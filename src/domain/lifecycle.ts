import type { JobObservation } from "./observations";

export interface ObservationChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ObservationDiff {
  fromObservationId: string;
  toObservationId: string;
  changes: ObservationChange[];
}

export interface PostingInference {
  type: "possible_repost";
  confidence: number;
  signals: string[];
  observationIds: [string, string];
}

const fields = [
  "sourceJobId", "title", "location", "employmentType", "postedDate", "postedDateQuality",
  "closingDate", "closingDateQuality", "description", "salary", "applicationUrl", "url",
] as const;

export function diffObservations(previous: JobObservation, current: JobObservation): ObservationDiff {
  const changes: ObservationChange[] = [];
  for (const field of fields) {
    if (previous[field] !== current[field]) {
      changes.push({ field, before: previous[field], after: current[field] });
    }
  }
  return { fromObservationId: previous.observationId, toObservationId: current.observationId, changes };
}

const normalizedWords = (value: string | null | undefined): Set<string> =>
  new Set((value ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 2));

const jaccard = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
};

export function inferPostingRelationship(a: JobObservation, b: JobObservation): PostingInference | null {
  const titleMatch = Boolean(a.title && b.title && a.title.trim().toLowerCase() === b.title.trim().toLowerCase());
  const locationMatch = Boolean(a.location && b.location && a.location.trim().toLowerCase() === b.location.trim().toLowerCase());
  const descriptionSimilarity = jaccard(normalizedWords(a.description), normalizedWords(b.description));
  if (!titleMatch || !locationMatch || descriptionSimilarity < 0.8) return null;

  const confidence = Number((0.5 + descriptionSimilarity * 0.4 + 0.1).toFixed(2));
  return {
    type: "possible_repost",
    confidence: Math.min(confidence, 0.99),
    signals: ["normalized title matches", "normalized location matches", `description similarity ${descriptionSimilarity.toFixed(2)}`],
    observationIds: [a.observationId, b.observationId],
  };
}
