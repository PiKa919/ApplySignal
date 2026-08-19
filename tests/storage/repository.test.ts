import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../src/storage/database";
import { listApplicationObservation, listHealEvents, listLatestObservations, listPostingEvents, listScrapeRuns, saveApplicationObservation, saveHealEvent, saveObservation, savePostingEvent, saveScrapeRun } from "../../src/storage/repository";

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
    eventType: "MEANINGFULLY_UPDATED",
    beforeObservationId: "obs-before",
    afterObservationId: "obs-after",
    evidence: { changes: [{ field: "closingDate" }] },
  }]);
});

test("round-trips structured application observations without candidate values", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-application", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", title: "Backend" } as any);
  saveApplicationObservation(db, "obs-application", {
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
  expect(listApplicationObservation(db, "obs-application")).toEqual({
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
