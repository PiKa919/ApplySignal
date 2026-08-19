import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { expandCollectorRows, ingestCollectorResult } from "../../src/collectors/ingest";
import { listAnalysisSnapshots, listScrapeRuns } from "../../src/storage/repository";

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

test("keeps same-id lifecycle versions when their public URLs differ", () => {
  const rows = expandCollectorRows([
    { source_job_id: "REQ-1", title: "Backend", url: "https://example.test/REQ-1?version=1" },
    { source_job_id: "REQ-1", title: "Backend", url: "https://example.test/REQ-1?version=2" },
  ]);
  expect(rows).toHaveLength(2);
});

test("quarantines structurally invalid output before saving observations", () => {
  const db = createDatabase(":memory:");
  expect(() => ingestCollectorResult(db, {
    runId: "run-health",
    collectorId: "c_test",
    sourceId: "visa",
    observedAt: "2026-08-20T00:00:00.000Z",
    status: "success",
    rawOutput: "raw",
    rows: [
      { source_job_id: "A", title: "Backend", location: "Bengaluru", url: "https://example.test/A" },
      { source_job_id: "B", title: "Designer", location: null, url: "https://example.test/B" },
    ],
    expectedMinimumRows: 2,
    requiredFields: ["source_job_id", "title", "location"],
    identityField: "source_job_id",
    expectedHost: "example.test",
    minimumCoverage: 0.75,
  } as any)).toThrow("quarantined");
  expect(listScrapeRuns(db)).toMatchObject([{ runId: "run-health", status: "quarantined", healthStatus: "quarantined" }]);
  expect(db.query("SELECT COUNT(*) as count FROM job_observations").get()).toEqual({ count: 0 });
});

test("persists a versioned analysis snapshot only after a healthy listing is stored", () => {
  const db = createDatabase(":memory:");
  ingestCollectorResult(db, {
    runId: "run-snapshot",
    collectorId: "c_test",
    sourceId: "zfh",
    observedAt: "2026-08-20T00:00:00.000Z",
    status: "success",
    rawOutput: "raw",
    rows: [{ source_job_id: "A", title: "Backend Engineer", location: "Bengaluru", url: "https://example.test/A", description: "Build APIs with TypeScript for the platform team." }],
    expectedMinimumRows: 1,
    requiredFields: ["source_job_id", "title", "location"],
    identityField: "source_job_id",
    expectedHost: "example.test",
    minimumCoverage: 1,
  } as any);
  expect(listAnalysisSnapshots(db)).toMatchObject([{
    observationId: expect.any(String),
    analysisVersion: "reciprocity-v1",
    analysis: { transparencyScore: expect.any(Number) },
  }]);
});
