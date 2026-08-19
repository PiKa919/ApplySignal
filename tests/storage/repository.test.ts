import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../src/storage/database";
import { listLatestObservations, listPostingEvents, saveObservation, savePostingEvent } from "../../src/storage/repository";

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
