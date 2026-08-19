import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { expandCollectorRows, ingestCollectorResult } from "../../src/collectors/ingest";
import { listScrapeRuns } from "../../src/storage/repository";

test("rejects a successful-looking collector result with silent cardinality loss", () => {
  const db = createDatabase(":memory:");
  expect(() => ingestCollectorResult(db, {
    runId: "run-cardinality",
    collectorId: "c_test", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z",
    status: "success", rawOutput: "[]", rows: [], expectedMinimumRows: 1,
  } as any)).toThrow("cardinality");
  expect(listScrapeRuns(db)).toMatchObject([{ runId: "run-cardinality", status: "cardinality_failed", rowCount: 0 }]);
});

test("records a failed collector run before surfacing the failure", () => {
  const db = createDatabase(":memory:");
  expect(() => ingestCollectorResult(db, {
    runId: "run-failed", collectorId: "c_test", sourceId: "visa", observedAt: "2026-08-20T00:00:00.000Z",
    status: "failed", rawOutput: "", stderr: "generation failed", rows: [], expectedMinimumRows: 1,
  } as any)).toThrow("collector failed");
  expect(listScrapeRuns(db)).toMatchObject([{ runId: "run-failed", status: "failed", rowCount: 0 }]);
});

test("flattens and deduplicates nested job envelopes before normalization", () => {
  const rows = expandCollectorRows([
    { jobs: [{ job_id: "A", title: "Backend", job_detail_url: "https://example.test/A" }] },
    { jobs: [{ job_id: "A", title: "Backend", job_detail_url: "https://example.test/A" }, { job_id: "B", title: "Designer", job_detail_url: "https://example.test/B" }] },
  ]);
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.source_job_id ?? row.job_id)).toEqual(["A", "B"]);
});
