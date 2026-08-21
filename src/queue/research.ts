import type { Database } from "bun:sqlite";
import { ingestCollectorResult } from "../collectors/ingest";
import { preflightPublicSource, type PublicSourcePreflightRequest, type PublicSourcePreflightResult } from "../collectors/preflight";
import { runBrightDataCollector, type CollectorRequest, type CollectorRunResult } from "../collectors/brightdata";
import { claimResearchQueue, failResearchQueueItem, completeResearchQueueItem, type ResearchQueueItem } from "../storage/repository";

export interface ResearchQueueConfig {
  collectorId: string;
  maxItems?: number;
  retryDelayMinutes?: number;
  preflightTimeoutMs?: number;
}

export interface ResearchQueueDependencies {
  preflight?: (request: PublicSourcePreflightRequest) => Promise<PublicSourcePreflightResult>;
  runCollector?: (request: CollectorRequest) => Promise<CollectorRunResult>;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface ResearchQueueResult {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  observationIds: string[];
}

const sourceIdFor = (url: string): string => {
  const host = new URL(url).hostname;
  return `submitted_${new Bun.CryptoHasher("sha256").update(host).digest("hex").slice(0, 12)}`;
};

const nextRetryAt = (now: Date, attempts: number, delayMinutes: number): string => {
  const delay = Math.min(24 * 60, delayMinutes * (2 ** Math.min(attempts, 6)));
  return new Date(now.getTime() + delay * 60_000).toISOString();
};

export async function processResearchQueue(db: Database, config: ResearchQueueConfig, dependencies: ResearchQueueDependencies = {}): Promise<ResearchQueueResult> {
  if (!config.collectorId) throw new Error("A research collector ID is required");
  const now = dependencies.now ?? (() => new Date());
  const log = dependencies.log ?? (() => undefined);
  const preflight = dependencies.preflight ?? preflightPublicSource;
  const runCollector = dependencies.runCollector ?? runBrightDataCollector;
  const claimed = claimResearchQueue(db, Math.max(1, config.maxItems ?? 1), now().toISOString());
  const result: ResearchQueueResult = { processed: 0, completed: 0, failed: 0, skipped: 0, observationIds: [] };

  for (const item of claimed) {
    result.processed += 1;
    const timestamp = now();
    try {
      const target = new URL(item.url);
      const sourceId = sourceIdFor(item.url);
      const preflightResult = await preflight({ sourceId, targetUrl: item.url, expectedHost: target.host, timeoutMs: config.preflightTimeoutMs ?? 15_000 });
      if (preflightResult.status !== "reachable") {
        throw new Error(`preflight_${preflightResult.status}${preflightResult.error ? `: ${preflightResult.error}` : ""}`);
      }
      const request: CollectorRequest = {
        collectorId: config.collectorId,
        sourceId,
        sourceUrl: item.url,
        url: item.url,
        expectedMinimumRows: 1,
        requiredFields: ["title", "location", "url"],
        urlField: "url",
        expectedHost: target.host,
        minimumCoverage: 0.8,
        scopeKind: "subset",
      };
      const collectorResult = await runCollector(request);
      const ingestion = ingestCollectorResult(db, { ...collectorResult, sourceId, sourceUrl: item.url }, "live");
      if (ingestion.observationIds.length === 0) throw new Error("research produced no observation");
      completeResearchQueueItem(db, item.id, ingestion.observationIds[0], timestamp.toISOString(), { sourceId, collectorId: config.collectorId, preflight: preflightResult });
      result.completed += 1;
      result.observationIds.push(ingestion.observationIds[0]);
      log(JSON.stringify({ queueId: item.id, status: "completed", observationId: ingestion.observationIds[0] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failResearchQueueItem(db, item.id, message, nextRetryAt(timestamp, item.attempts, config.retryDelayMinutes ?? 15), timestamp.toISOString());
      result.failed += 1;
      log(JSON.stringify({ queueId: item.id, status: "failed", error: message }));
    }
  }
  return result;
}

export type { ResearchQueueItem };
