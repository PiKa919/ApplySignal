import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { inferPostingRelationship } from "../../src/domain/lifecycle";
import { normalizeJobObservation } from "../../src/domain/normalize";
import { loadControlledFixture } from "../../src/collectors/controlled-fixture";
import { ingestApplicationFields, ingestCollectorResult } from "../../src/collectors/ingest";
import { createDatabase } from "../../src/storage/database";
import { listApplicationFields } from "../../src/storage/repository";

test("lifecycle demo keeps two observations separate and inferable", async () => {
  const rows = JSON.parse(await readFile(new URL("../../src/collectors/fixtures/lifecycle-demo.json", import.meta.url), "utf8"));
  const context = { sourceId: "demo-lifecycle", sourceUrl: "https://example.test/demo-lifecycle", observedAt: "2026-08-20T10:00:00.000Z" };
  const before = normalizeJobObservation(rows[0], { ...context, observedAt: "2026-08-01T10:00:00.000Z" });
  const after = normalizeJobObservation(rows[1], { ...context, observedAt: "2026-08-20T10:00:00.000Z" });

  expect(before.observationId).not.toBe(after.observationId);
  expect(before.sourceJobId).toBe(after.sourceJobId);
  expect(inferPostingRelationship(before, after)?.type).toBe("possible_repost");
});

test("controlled fixture contains six labeled edge cases in two equivalent layouts", async () => {
  const layoutA = await loadControlledFixture("layout-a");
  const layoutB = await loadControlledFixture("layout-b");
  expect(layoutA.rows).toHaveLength(6);
  expect(layoutB.rows).toHaveLength(6);
  expect(layoutA.rows.map((row) => row.source_job_id)).toEqual(layoutB.rows.map((row) => row.source_job_id));
  expect(layoutA.rows.map((row) => row.source_job_id)).toEqual([
    "fixture-fresh-001",
    "fixture-relative-002",
    "fixture-evergreen-003",
    "fixture-talent-004",
    "fixture-multi-005",
    "fixture-rich-006",
  ]);
});

test("controlled fixture exposes rich public application fields without candidate values", async () => {
  const fixture = await loadControlledFixture("layout-a");
  expect(fixture.applicationFields["fixture-rich-006"]).toEqual(expect.arrayContaining([
    expect.objectContaining({ field_label: "Resume", normalized_category: "resume", is_required: true }),
    expect.objectContaining({ field_label: "Current CTC", normalized_category: "compensation_history", is_required: true }),
  ]));
  expect(JSON.stringify(fixture.applicationFields)).not.toContain("candidate");
});

test("controlled fixture ingestion persists the rich public form without values", async () => {
  const db = createDatabase(":memory:");
  const fixture = await loadControlledFixture("layout-b");
  const result = ingestCollectorResult(db, {
    runId: "controlled-layout-b",
    collectorId: "controlled-fixture",
    sourceId: "demo-controlled",
    sourceUrl: "https://fixture.applysignal.test/jobs",
    observedAt: "2026-08-20T10:00:00.000Z",
    status: "success",
    rawOutput: JSON.stringify(fixture.rows),
    stderr: "",
    rows: fixture.rows,
    expectedMinimumRows: 6,
    requiredFields: ["source_job_id", "title", "location", "url"],
    identityField: "source_job_id",
    expectedHost: "fixture.applysignal.test",
  }, "fixture");
  const richObservationId = result.observationIds[5];
  const count = ingestApplicationFields(db, richObservationId, { application_form_fields: fixture.applicationFields["fixture-rich-006"] });
  expect(count).toBe(8);
  expect(listApplicationFields(db, richObservationId)).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Resume", required: true }),
    expect.objectContaining({ label: "Current CTC", required: true }),
  ]));
});
