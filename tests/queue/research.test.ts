import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { enqueueResearchUrl, listResearchQueue } from "../../src/storage/repository";
import { processResearchQueue } from "../../src/queue/research";

test("queue processor does not spend Bright Data credits when preflight blocks", async () => {
  const db = createDatabase(":memory:");
  enqueueResearchUrl(db, "https://example.com/jobs/blocked");
  let paidCalls = 0;
  const result = await processResearchQueue(db, { collectorId: "c_research", maxItems: 1 }, {
    preflight: async () => ({ status: "blocked", finalUrl: "https://example.com/jobs/blocked", httpStatus: 403, evidence: "blocked" }),
    runCollector: async () => { paidCalls += 1; throw new Error("paid collector should not run"); },
  });

  expect(paidCalls).toBe(0);
  expect(result).toMatchObject({ processed: 1, completed: 0, failed: 1 });
  expect(listResearchQueue(db)[0]).toMatchObject({ status: "failed" });
});

test("queue processor ingests one verified row and completes the queue item", async () => {
  const db = createDatabase(":memory:");
  enqueueResearchUrl(db, "https://example.com/jobs/live");
  const result = await processResearchQueue(db, { collectorId: "c_research", maxItems: 1 }, {
    preflight: async () => ({ status: "reachable", finalUrl: "https://example.com/jobs/live", httpStatus: 200, evidence: "public detail" }),
    runCollector: async (request) => ({
      runId: "run-research",
      collectorId: request.collectorId,
      sourceId: request.sourceId,
      sourceUrl: request.sourceUrl,
      observedAt: "2026-08-21T10:00:00.000Z",
      status: "success",
      rawOutput: JSON.stringify([{ title: "Backend Engineer", company_name: "Example Co", location: "Remote", url: request.url }]),
      stderr: "",
      rows: [{ title: "Backend Engineer", company_name: "Example Co", location: "Remote", url: request.url }],
      expectedMinimumRows: 1,
      requiredFields: ["title", "location", "url"],
      urlField: "url",
      expectedHost: "example.com",
      scopeKind: "subset",
    }),
  });

  expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
  expect(listResearchQueue(db)[0]).toMatchObject({ status: "completed" });
  expect((await (await import("../../src/server")).createAppServer(db, { liveOnly: true }).fetch(new Request("http://local/api/jobs"))).status).toBe(200);
});
