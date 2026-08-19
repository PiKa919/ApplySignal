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

export const LIFECYCLE_STATES = [
  "NEWLY_OBSERVED",
  "ACTIVE_STABLE",
  "MEANINGFULLY_UPDATED",
  "REMOVED",
  "REAPPEARED",
  "EXPLICIT_EVERGREEN",
  "TALENT_POOL",
  "POSSIBLE_REPOST",
  "APPLICATION_CLOSED",
  "UNKNOWN",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export interface LifecycleClassificationInput {
  current: JobObservation | null;
  previous?: JobObservation | null;
  currentWasPresent?: boolean;
  previousWasPresent?: boolean;
  applicationOpen?: boolean | null;
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

const samePosting = (a: JobObservation, b: JobObservation): boolean => {
  if (a.sourceJobId && b.sourceJobId) return a.sourceJobId === b.sourceJobId;
  if (a.url && b.url) return a.url === b.url;
  return false;
};

export function classifyLifecycleState(input: LifecycleClassificationInput): LifecycleState {
  const { current, previous } = input;
  if (input.currentWasPresent === false) return previous ? "REMOVED" : "UNKNOWN";
  if (!current) return "UNKNOWN";
  if (input.applicationOpen === false) return "APPLICATION_CLOSED";
  if (current.flags?.talentPool) return "TALENT_POOL";
  if (current.flags?.explicitEvergreen) return "EXPLICIT_EVERGREEN";
  if (input.previousWasPresent === false && previous) return "REAPPEARED";
  if (!previous) return "NEWLY_OBSERVED";
  if (samePosting(previous, current)) {
    return diffObservations(previous, current).changes.length > 0 ? "MEANINGFULLY_UPDATED" : "ACTIVE_STABLE";
  }
  return inferPostingRelationship(previous, current) ? "POSSIBLE_REPOST" : "NEWLY_OBSERVED";
}
