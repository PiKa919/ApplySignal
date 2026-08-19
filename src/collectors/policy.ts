import type { CollectorRequest } from "./brightdata";
import type { ScrapeRunHealth } from "../storage/repository";

export type PaidRunDecision = { skip: false } | { skip: true; reason: "recent_success" };

export interface PaidRunPolicyOptions {
  cooldownHours?: number;
  force?: boolean;
}

export function shouldSkipPaidRun(
  runs: ScrapeRunHealth[],
  request: Pick<CollectorRequest, "collectorId" | "sourceId">,
  now = new Date(),
  options: PaidRunPolicyOptions = {},
): PaidRunDecision {
  if (options.force) return { skip: false };
  const cooldownHours = options.cooldownHours ?? 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const recentSuccess = runs.some((run) =>
    run.collectorId === request.collectorId &&
    run.sourceId === request.sourceId &&
    run.status === "success" &&
    now.getTime() - new Date(run.observedAt).getTime() >= 0 &&
    now.getTime() - new Date(run.observedAt).getTime() < cooldownMs,
  );
  return recentSuccess ? { skip: true, reason: "recent_success" } : { skip: false };
}
