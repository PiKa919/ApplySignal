import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { auditDatabase } from "../../src/cli/audit";
import { saveObservation, saveScrapeRun } from "../../src/storage/repository";

test("auditDatabase reports observations and source scope without collecting", () => {
  const db = createDatabase(":memory:");
  saveScrapeRun(db, { runId: "run-1", collectorId: "collector-1", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", status: "success", rowCount: 1, expectedMinimumRows: 1, rawOutput: "[]" });
  saveObservation(db, { observationId: "obs-1", sourceId: "zfh", sourceUrl: "https://example.test", observedAt: "2026-08-20T00:00:00.000Z", sourceJobId: "job-1", title: "Backend", location: "Bengaluru", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1, dataMode: "live" });
  const result = auditDatabase(db);
  expect(result.observations).toBe(1);
  expect(result.runs).toBe(1);
  expect(result.activeSources).toContain("zfh");
  expect(result.partialSources).toContain("postman");
  db.close();
});
