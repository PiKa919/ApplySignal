import { readFile } from "node:fs/promises";
import { createDatabase } from "../storage/database";
import { ingestApplicationFields, ingestCollectorResult } from "../collectors/ingest";
import { loadControlledFixture, type ControlledFixtureLayout } from "../collectors/controlled-fixture";

const rows = JSON.parse(await readFile(new URL("../collectors/fixtures/zfh-jobs.json", import.meta.url), "utf8"));
const lifecycleRows = JSON.parse(await readFile(new URL("../collectors/fixtures/lifecycle-demo.json", import.meta.url), "utf8"));
const controlledLayout: ControlledFixtureLayout = process.env.APPLYSIGNAL_FIXTURE_LAYOUT === "layout-b" ? "layout-b" : "layout-a";
const controlledFixture = await loadControlledFixture(controlledLayout);
const dbPath = process.env.APPLYSIGNAL_DB ?? "data/applysignal.db";
const db = createDatabase(dbPath);
const result = ingestCollectorResult(db, {
  runId: `fixture-${Date.now()}`,
  collectorId: "fixture-zfh",
  sourceId: "zfh",
  sourceUrl: "https://careers.zerodhafundhouse.com/jobs",
  observedAt: new Date().toISOString(),
  status: "success",
  rawOutput: JSON.stringify(rows),
  stderr: "",
  rows,
  expectedMinimumRows: 2,
}, "fixture");
console.log(JSON.stringify(result));
const lifecycleResult = ingestCollectorResult(db, {
  runId: `fixture-lifecycle-${Date.now()}`,
  collectorId: "fixture-lifecycle",
  sourceId: "demo-lifecycle",
  sourceUrl: "https://example.test/demo-lifecycle",
  observedAt: new Date().toISOString(),
  status: "success",
  rawOutput: JSON.stringify(lifecycleRows),
  stderr: "",
  rows: lifecycleRows,
  expectedMinimumRows: 2,
}, "fixture");
console.log(JSON.stringify(lifecycleResult));
const controlledResult = ingestCollectorResult(db, {
  runId: `fixture-controlled-${controlledLayout}-${Date.now()}`,
  collectorId: "fixture-controlled-career-site",
  sourceId: "demo-controlled",
  sourceUrl: "https://fixture.applysignal.test/jobs",
  observedAt: new Date().toISOString(),
  status: "success",
  rawOutput: JSON.stringify(controlledFixture.rows),
  stderr: "",
  rows: controlledFixture.rows,
  expectedMinimumRows: 6,
  requiredFields: ["source_job_id", "title", "location", "url"],
  identityField: "source_job_id",
  expectedHost: "fixture.applysignal.test",
}, "fixture");
const richIndex = controlledFixture.rows.findIndex((row) => row.source_job_id === "fixture-rich-006");
if (richIndex >= 0) {
  ingestApplicationFields(db, controlledResult.observationIds[richIndex], { application_form_fields: controlledFixture.applicationFields["fixture-rich-006"] });
}
console.log(JSON.stringify({ ...controlledResult, layout: controlledFixture.layoutId, layoutLabel: controlledFixture.layoutLabel }));
db.close();
