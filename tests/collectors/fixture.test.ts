import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { ingestCollectorResult } from "../../src/collectors/ingest";

test("fixture ingestion produces two labeled observations", () => {
  const db = createDatabase(":memory:");
  const result = ingestCollectorResult(db, {
    runId: "fixture-run",
    collectorId: "fixture",
    sourceId: "zfh",
    sourceUrl: "https://careers.zerodhafundhouse.com/jobs",
    observedAt: "2026-08-20T00:00:00.000Z",
    status: "success",
    rawOutput: "fixture",
    stderr: "",
    expectedMinimumRows: 2,
    rows: [
      { source_job_id: "fixture-1", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs", url: "https://example.test/1" },
      { source_job_id: "fixture-2", title: "Apply here", location: "Bengaluru", description: "Join our talent pool", url: "https://example.test/2" },
    ],
  }, "fixture");
  expect(result.dataMode).toBe("fixture");
  expect(result.rowCount).toBe(2);
});
