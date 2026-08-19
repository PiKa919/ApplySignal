import { expect, test } from "bun:test";
import { createDatabase } from "../src/storage/database";
import { createAppServer } from "../src/server";
import { saveScrapeRun } from "../src/storage/repository";
import { saveObservation } from "../src/storage/repository";

test("summary endpoint exposes source confidence separately from job analysis", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/api/summary"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ sourceConfidence: expect.any(Array), analyses: expect.any(Array) });
});

test("dashboard includes the AI-use disclosure", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/"));
  expect(await response.text()).toContain("AI USE DISCLOSURE");
});

test("summary endpoint exposes collector health separately from observations", async () => {
  const db = createDatabase(":memory:");
  saveScrapeRun(db, { runId: "run-1", collectorId: "collector-1", sourceId: "visa", observedAt: "2026-08-20T00:00:00.000Z", status: "failed", rowCount: 0, expectedMinimumRows: 1, rawOutput: "" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({ runs: [{ sourceId: "visa", status: "failed", rowCount: 0 }] });
});

test("summary endpoint exposes source catalog states without treating them as observations", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/api/summary"));
  const body = await response.json();
  expect(body.sourceCatalog).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceId: "zfh", status: "live" }),
    expect.objectContaining({ sourceId: "visa", status: "live_scoped" }),
  ]));
});

test("job detail keeps a possible repost as an inference separate from field diffs", async () => {
  const db = createDatabase(":memory:");
  const base = { sourceId: "zfh", sourceUrl: "https://example.test/jobs", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs with TypeScript", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any;
  saveObservation(db, { ...base, observationId: "obs-old", observedAt: "2026-08-19T00:00:00.000Z" });
  saveObservation(db, { ...base, observationId: "obs-new", observedAt: "2026-08-20T00:00:00.000Z" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/jobs/obs-new"));
  expect(await response.json()).toMatchObject({ inferences: [expect.objectContaining({ type: "possible_repost", observationIds: ["obs-old", "obs-new"] })] });
});
