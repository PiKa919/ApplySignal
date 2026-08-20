import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../src/storage/database";
import { listAnalysisSnapshots, listApplicationObservation, listHealEvents, listLatestObservations, listLineageEdges, listPostings, listPostingEvents, listScrapeRuns, listSources, markLatestHealEvent, saveAnalysisSnapshot, saveApplicationObservation, saveHealEvent, saveInference, saveObservation, savePostingEvent, saveScrapeRun } from "../../src/storage/repository";

test("round-trips observations without collapsing unknown fields", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-1", sourceId: "zfh", title: "Designer", location: null, salary: null } as any);
  expect(listLatestObservations(db, "zfh")[0]).toMatchObject({ observationId: "obs-1", salary: null });
});

test("round-trips derived posting flags separately from raw provenance", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-talent", sourceId: "zfh", title: "Apply here", flags: { explicitEvergreen: false, evergreenLike: true, talentPool: true, multipleOpenings: false } } as any);
  expect(listLatestObservations(db, "zfh")[0].flags).toEqual({ explicitEvergreen: false, evergreenLike: true, talentPool: true, multipleOpenings: false });
});

test("creates the parent directory for a fresh file-backed database", async () => {
  const root = await mkdtemp(join(tmpdir(), "applysignal-db-"));
  const db = createDatabase(join(root, "nested", "applysignal.db"));
  expect(db.query("SELECT 1 as ok").get()).toEqual({ ok: 1 });
  db.close();
  await rm(root, { recursive: true, force: true });
});

test("round-trips lifecycle events separately from observations", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-before", sourceId: "demo-lifecycle", sourceJobId: "REQ-EVENT", observedAt: "2026-08-19T00:00:00.000Z" } as any);
  saveObservation(db, { observationId: "obs-after", sourceId: "demo-lifecycle", sourceJobId: "REQ-EVENT", observedAt: "2026-08-20T00:00:00.000Z" } as any);
  savePostingEvent(db, {
    sourceId: "demo-lifecycle",
    eventType: "MEANINGFULLY_UPDATED",
    beforeObservationId: "obs-before",
    afterObservationId: "obs-after",
    observedAt: "2026-08-20T00:00:00.000Z",
    evidence: { changes: [{ field: "closingDate", before: null, after: "2026-09-01" }] },
  });
  expect(listPostingEvents(db)).toMatchObject([{
    sourceId: "demo-lifecycle",
    postingId: "demo-lifecycle::REQ-EVENT",
    eventType: "MEANINGFULLY_UPDATED",
    beforePostingId: "demo-lifecycle::REQ-EVENT",
    afterPostingId: "demo-lifecycle::REQ-EVENT",
    beforeObservationId: "obs-before",
    afterObservationId: "obs-after",
    evidence: { changes: [{ field: "closingDate" }] },
  }]);
});

test("round-trips structured application observations without candidate values", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-application", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", title: "Backend" } as any);
  saveApplicationObservation(db, "obs-application", {
    formUrl: "https://example.test/jobs/backend/apply",
    accountGate: true,
    resumeRequired: true,
    requiredFieldCount: 2,
    optionalFieldCount: 1,
    unknownFieldCount: 0,
    customQuestionCount: 1,
    longAnswerCount: 1,
    attachmentCount: 1,
    manualHistoryFields: ["Current CTC"],
  }, "2026-08-20T00:00:00.000Z");
  expect(db.query("SELECT posting_id as postingId FROM application_observations WHERE observation_id = ?").get("obs-application")).toEqual({ postingId: "zfh::obs-application" });
  expect(listApplicationObservation(db, "obs-application")).toEqual({
    formUrl: "https://example.test/jobs/backend/apply",
    accountGate: true,
    resumeRequired: true,
    requiredFieldCount: 2,
    optionalFieldCount: 1,
    unknownFieldCount: 0,
    customQuestionCount: 1,
    longAnswerCount: 1,
    attachmentCount: 1,
    manualHistoryFields: ["Current CTC"],
  });
});

test("versioned analysis snapshots round-trip and replace the same observation version", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-snapshot", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", title: "Backend" } as any);
  saveAnalysisSnapshot(db, {
    snapshotId: "obs-snapshot:reciprocity-v1",
    observationId: "obs-snapshot",
    analysisVersion: "reciprocity-v1",
    generatedAt: "2026-08-20T00:01:00.000Z",
    analysis: { transparencyScore: 42, lifecycleState: "NEW" },
  });
  saveAnalysisSnapshot(db, {
    snapshotId: "obs-snapshot:reciprocity-v1",
    observationId: "obs-snapshot",
    analysisVersion: "reciprocity-v1",
    generatedAt: "2026-08-20T00:02:00.000Z",
    analysis: { transparencyScore: 48, lifecycleState: "NEW" },
  });
  expect(listAnalysisSnapshots(db)).toEqual([{
    snapshotId: "obs-snapshot:reciprocity-v1",
    observationId: "obs-snapshot",
    postingId: "zfh::obs-snapshot",
    analysisVersion: "reciprocity-v1",
    generatedAt: "2026-08-20T00:02:00.000Z",
    analysis: { transparencyScore: 48, lifecycleState: "NEW" },
  }]);
});

test("keeps application scrape runs distinct from listing runs", () => {
  const db = createDatabase(":memory:");
  saveScrapeRun(db, {
    runId: "run-application",
    collectorId: "collector-application",
    sourceId: "zfh",
    runKind: "application",
    observedAt: "2026-08-20T00:00:00.000Z",
    status: "success",
    rowCount: 17,
    expectedMinimumRows: 1,
    rawOutput: "[redacted]",
  });
  expect(listScrapeRuns(db)[0]).toMatchObject({ runKind: "application", rowCount: 17 });
});

test("round-trips review-gated heal evidence separately from scrape runs", () => {
  const db = createDatabase(":memory:");
  saveHealEvent(db, {
    sourceId: "visa",
    collectorId: "c_visa",
    failedRunId: "run-bad",
    reason: "location coverage collapsed",
    generatedPrompt: "Restore location extraction without changing the schema.",
    previewResult: { status: "returned" },
    previewHealth: { status: "healthy", recordCount: 10 },
    approved: null,
    repairedRunId: null,
  });
  expect(listHealEvents(db)).toMatchObject([{
    sourceId: "visa",
    collectorId: "c_visa",
    failedRunId: "run-bad",
    approved: null,
    previewHealth: { recordCount: 10 },
  }]);
});

test("marks the latest matching heal event only after explicit approval", () => {
  const db = createDatabase(":memory:");
  saveHealEvent(db, {
    sourceId: "visa",
    collectorId: "c_test",
    failedRunId: "run-bad",
    reason: "location drift",
    generatedPrompt: "Restore location",
    previewResult: { status: "awaiting_approval" },
    previewHealth: null,
    approved: null,
    repairedRunId: null,
  });
  expect(markLatestHealEvent(db, { sourceId: "visa", collectorId: "c_test", failedRunId: "run-bad", approved: true, repairedRunId: null })).toBe(true);
  expect(listHealEvents(db)[0]).toMatchObject({ approved: true, repairedRunId: null });
});

test("persists the source catalog independently from observations", () => {
  const db = createDatabase(":memory:");
  expect(listSources(db)).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceId: "zfh", status: "live", sourceFamily: "custom", collectorId: "c_mt0gzmiq1zdx7m835o", oracleId: null }),
    expect.objectContaining({ sourceId: "browserstack", status: "unresolved" }),
  ]));
});

test("persists repost inference as an explicit lineage edge", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-old", sourceId: "zfh", sourceJobId: "REQ-OLD", observedAt: "2026-08-19T00:00:00.000Z" } as any);
  saveObservation(db, { observationId: "obs-new", sourceId: "zfh", sourceJobId: "REQ-NEW", observedAt: "2026-08-20T00:00:00.000Z" } as any);
  saveInference(db, {
    type: "possible_repost",
    confidence: 0.94,
    signals: ["normalized title matches", "normalized location matches"],
    observationIds: ["obs-old", "obs-new"],
  });
  expect(listLineageEdges(db)).toMatchObject([{
    fromPostingId: "zfh::REQ-OLD",
    toPostingId: "zfh::REQ-NEW",
    fromObservationId: "obs-old",
    toObservationId: "obs-new",
    relation: "possible_repost",
    confidence: 0.94,
    evidence: { signals: ["normalized title matches", "normalized location matches"] },
    algorithmVersion: "repost-v1",
  }]);
});

test("links lifecycle observations to one stable posting record", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-old", sourceId: "zfh", sourceJobId: "REQ-1", url: "https://example.test/jobs/old", observedAt: "2026-08-19T00:00:00.000Z" } as any);
  saveObservation(db, { observationId: "obs-new", sourceId: "zfh", sourceJobId: "REQ-1", url: "https://example.test/jobs/new", observedAt: "2026-08-20T00:00:00.000Z" } as any);
  expect(listPostings(db)).toMatchObject([{
    postingId: "zfh::REQ-1",
    sourceId: "zfh",
    sourcePostingKey: "REQ-1",
    canonicalUrl: "https://example.test/jobs/new",
    firstSeenAt: "2026-08-19T00:00:00.000Z",
    lastSeenAt: "2026-08-20T00:00:00.000Z",
  }]);
  expect(listLatestObservations(db, "zfh").map((observation) => observation.postingId)).toEqual(["zfh::REQ-1", "zfh::REQ-1"]);
});

test("backfills posting records when an older database is reopened", async () => {
  const root = await mkdtemp(join(tmpdir(), "applysignal-posting-migration-"));
  const path = join(root, "applysignal.db");
  const first = createDatabase(path);
  saveObservation(first, { observationId: "obs-old", sourceId: "zfh", sourceJobId: "REQ-MIGRATE", url: "https://example.test/jobs/migrate", observedAt: "2026-08-20T00:00:00.000Z" } as any);
  first.exec("DELETE FROM postings");
  first.exec("UPDATE job_observations SET posting_id = NULL");
  first.close();

  const reopened = createDatabase(path);
  expect(listPostings(reopened)).toMatchObject([expect.objectContaining({ postingId: "zfh::REQ-MIGRATE", sourcePostingKey: "REQ-MIGRATE" })]);
  expect(listLatestObservations(reopened, "zfh")[0].postingId).toBe("zfh::REQ-MIGRATE");
  reopened.close();
  await rm(root, { recursive: true, force: true });
});
