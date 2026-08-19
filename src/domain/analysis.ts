import { analyzeFreshness } from "./freshness";
import { classifyLifecycleState } from "./lifecycle";
import { analyzeReciprocity, type ApplicationFieldObservation, type ReciprocityAnalysis } from "./reciprocity";
import type { JobObservation } from "./observations";

export const ANALYSIS_VERSION = "reciprocity-v1";

export type ObservationAnalysis = ReciprocityAnalysis & {
  lifecycleState: ReturnType<typeof classifyLifecycleState>;
  freshness: ReturnType<typeof analyzeFreshness>;
};

export function buildObservationAnalysis(
  observation: JobObservation,
  previous: JobObservation | null,
  fields: ApplicationFieldObservation[],
): ObservationAnalysis {
  return {
    ...analyzeReciprocity(observation, fields),
    lifecycleState: classifyLifecycleState({ current: observation, previous }),
    freshness: analyzeFreshness(observation),
  };
}
