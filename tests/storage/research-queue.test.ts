import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { claimResearchQueue, completeResearchQueueItem, enqueueResearchUrl, failResearchQueueItem, listResearchQueue } from "../../src/storage/repository";

test("research queue canonicalizes and deduplicates submitted URLs", () => {
  const db = createDatabase(":memory:");
  const first = enqueueResearchUrl(db, "https://Example.com/jobs/123/#apply");
  const duplicate = enqueueResearchUrl(db, "https://example.com/jobs/123/");

  expect(first.id).toBe(duplicate.id);
  expect(duplicate.duplicate).toBe(true);
  expect(listResearchQueue(db)).toHaveLength(1);
  expect(listResearchQueue(db)[0]).toMatchObject({ status: "pending", url: "https://example.com/jobs/123" });
});

test("research queue supports claim, retryable failure, and completion", () => {
  const db = createDatabase(":memory:");
  const item = enqueueResearchUrl(db, "https://example.com/jobs/456").item;
  const claimed = claimResearchQueue(db, 1, "2026-08-21T10:00:00.000Z");
  expect(claimed).toHaveLength(1);
  expect(claimed[0].id).toBe(item.id);
  expect(claimed[0].status).toBe("processing");

  failResearchQueueItem(db, item.id, "preflight_blocked", "2026-08-21T10:05:00.000Z");
  expect(listResearchQueue(db)[0]).toMatchObject({ status: "failed", attempts: 1, lastError: "preflight_blocked" });

  completeResearchQueueItem(db, item.id, "obs_123", "2026-08-21T10:06:00.000Z");
  expect(listResearchQueue(db)[0]).toMatchObject({ status: "completed", observationId: "obs_123" });
});
