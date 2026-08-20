import { expect, test } from "bun:test";
import { createDatabase } from "../src/storage/database";
import { createAppServer } from "../src/server";
import { saveScrapeRun } from "../src/storage/repository";
import { saveObservation } from "../src/storage/repository";
import { saveValidationResult } from "../src/storage/repository";
import { saveAnalysisSnapshot, saveApplicationObservation, saveHealEvent, saveInference, savePostingEvent } from "../src/storage/repository";

test("summary endpoint exposes source confidence separately from job analysis", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/api/summary"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ sourceConfidence: expect.any(Array), analyses: expect.any(Array) });
});

test("summary and jobs use persisted analysis snapshots when available", async () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-snapshot-api", sourceId: "zfh", title: "Backend", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any);
  saveAnalysisSnapshot(db, {
    snapshotId: "obs-snapshot-api:reciprocity-v1",
    observationId: "obs-snapshot-api",
    analysisVersion: "reciprocity-v1",
    generatedAt: "2026-08-20T00:01:00.000Z",
    analysis: { transparencyScore: 77, transparencySignals: [], transparencyInterpretation: "persisted", lifecycleState: "NEW", freshness: { precision: "exact" } },
  });
  const summary = await (await createAppServer(db).fetch(new Request("http://local/api/summary"))).json();
  const jobs = await (await createAppServer(db).fetch(new Request("http://local/api/jobs"))).json();
  expect(summary.analysisSnapshots).toMatchObject([{ observationId: "obs-snapshot-api", analysisVersion: "reciprocity-v1" }]);
  expect(summary.analyses[0]).toMatchObject({ transparencyScore: 77, transparencyInterpretation: "persisted" });
  expect(jobs[0].analysis).toMatchObject({ transparencyScore: 77, transparencyInterpretation: "persisted" });
});

test("dashboard includes the AI-use disclosure", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/"));
  expect(await response.text()).toContain("AI USE DISCLOSURE");
});

test("dashboard includes active source coverage metrics", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("ACTIVE SOURCES");
});

test("dashboard exposes the explainable transparency score and signal breakdown", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("TRANSPARENCY SCORE");
  expect(body).toContain("transparencySignals");
  expect(body).toContain("public disclosure signals");
});

test("dashboard serves browser-parseable JavaScript", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(() => new Function(body)).not.toThrow();
});

test("jobs endpoint stays responsive as observations grow", async () => {
  const db = createDatabase(":memory:");
  const description = "Build APIs with TypeScript. ".repeat(400);
  for (let index = 0; index < 300; index += 1) {
    saveObservation(db, {
      observationId: `obs-${index}`,
      sourceId: "zfh",
      observedAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      title: `Engineer ${index}`,
      location: "Bengaluru",
      description,
      postedDateQuality: "unavailable",
      closingDateQuality: "unavailable",
      provenance: {},
      sourceConfidence: 1,
    } as any);
  }
  const startedAt = performance.now();
  const response = await createAppServer(db).fetch(new Request("http://local/api/jobs"));
  const elapsedMs = performance.now() - startedAt;
  expect(response.status).toBe(200);
  expect(elapsedMs).toBeLessThan(1500);
});

test("dashboard renders structural health state for collector runs", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("healthStatus");
});

test("dashboard exposes health evidence details for source runs", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("HEALTH EVIDENCE");
  expect(body).toContain("duplicateUrlCount");
  expect(body).toContain("paginationErrors");
});

test("dashboard labels last-known-good evidence", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("LAST KNOWN GOOD");
});

test("dashboard labels review-gated heal evidence", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("HEAL REVIEW");
});

test("dashboard renders explicit source scope", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("boardKind");
});

test("dashboard includes independent oracle validation", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("ORACLE VALIDATION");
  expect(body).toContain("IDs matched");
});

test("dashboard keeps lifecycle state visible as an independent signal", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("lifecycleState");
  expect(body).toContain("LIFECYCLE");
});

test("dashboard keeps freshness evidence visible as an independent signal", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("freshness");
  expect(body).toContain("FRESHNESS");
});

test("job detail UI includes the resume re-entry tax", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("RESUME RE-ENTRY TAX");
});

test("job detail UI includes evergreen and talent-pool flags", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  expect(await response.text()).toContain("TALENT POOL");
});

test("job detail UI includes evidence links and raw observed fields", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("RAW OBSERVED FIELDS");
  expect(body).toContain("Source URL");
});

test("summary endpoint exposes collector health separately from observations", async () => {
  const db = createDatabase(":memory:");
  saveScrapeRun(db, { runId: "run-1", collectorId: "collector-1", sourceId: "visa", observedAt: "2026-08-20T00:00:00.000Z", status: "failed", rowCount: 0, expectedMinimumRows: 1, rawOutput: "" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({ runs: [{ sourceId: "visa", status: "failed", rowCount: 0 }] });
});

test("summary endpoint exposes structural quarantine evidence", async () => {
  const db = createDatabase(":memory:");
  saveScrapeRun(db, { runId: "run-quarantined", collectorId: "collector-1", sourceId: "visa", observedAt: "2026-08-20T00:00:00.000Z", status: "quarantined", rowCount: 2, expectedMinimumRows: 2, healthStatus: "quarantined", healthReport: { errors: ["field coverage below threshold: location"] }, rawOutput: "raw" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({ runs: [{ status: "quarantined", healthStatus: "quarantined", healthReport: { errors: ["field coverage below threshold: location"] } }] });
});

test("summary exposes last-known-good runs separately from a quarantined run", async () => {
  const db = createDatabase(":memory:");
  saveScrapeRun(db, { runId: "run-good", collectorId: "collector-1", sourceId: "visa", observedAt: "2026-08-19T00:00:00.000Z", status: "success", rowCount: 10, expectedMinimumRows: 1, rawOutput: "[]" });
  saveScrapeRun(db, { runId: "run-bad", collectorId: "collector-1", sourceId: "visa", observedAt: "2026-08-20T00:00:00.000Z", status: "quarantined", rowCount: 10, expectedMinimumRows: 1, healthStatus: "quarantined", healthReport: { errors: ["location coverage collapsed"] }, rawOutput: "raw" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({
    lastKnownGood: [{ sourceId: "visa", runId: "run-good", rowCount: 10 }],
  });
});

test("summary exposes review-gated healing evidence", async () => {
  const db = createDatabase(":memory:");
  saveHealEvent(db, {
    sourceId: "visa",
    collectorId: "c_visa",
    failedRunId: "run-bad",
    reason: "location coverage collapsed",
    generatedPrompt: "Restore location extraction.",
    previewResult: { status: "returned" },
    previewHealth: { status: "healthy" },
    approved: null,
    repairedRunId: null,
  });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({ healEvents: [{ sourceId: "visa", approved: null, previewHealth: { status: "healthy" } }] });
});

test("summary endpoint exposes oracle validation separately from collector health", async () => {
  const db = createDatabase(":memory:");
  saveValidationResult(db, {
    sourceId: "postman",
    oracleId: "postman-greenhouse",
    checkedAt: "2026-08-20T00:00:00.000Z",
    scraperCount: 1,
    oracleCount: 1,
    matchedCount: 1,
    missingFromScraper: [],
    unexpectedInScraper: [],
    agreementRate: 1,
    status: "agree",
  });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({ validationResults: [expect.objectContaining({ sourceId: "postman", status: "agree" })] });
});

test("summary endpoint exposes source catalog states without treating them as observations", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/api/summary"));
  const body = await response.json();
  expect(body.sourceCatalog).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceId: "zfh", status: "live", sourceFamily: "custom", collectorId: "c_mt0gzmiq1zdx7m835o", scope: expect.objectContaining({ boardKind: "all_jobs" }) }),
    expect.objectContaining({ sourceId: "visa", status: "live_scoped", scope: expect.objectContaining({ boardKind: "subset" }) }),
  ]));
});

test("summary serves persisted source metadata and lineage edges", async () => {
  const db = createDatabase(":memory:");
  db.query("UPDATE sources SET note = ? WHERE source_id = ?").run("persisted source note", "zfh");
  saveObservation(db, { observationId: "old", sourceId: "zfh", sourceJobId: "REQ-OLD", url: "https://example.test/jobs/old" } as any);
  saveObservation(db, { observationId: "new", sourceId: "zfh", sourceJobId: "REQ-1", url: "https://example.test/jobs/1" } as any);
  saveInference(db, { type: "possible_repost", confidence: 0.9, signals: ["title"], observationIds: ["old", "new"] });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  expect(await response.json()).toMatchObject({
    sourceCatalog: expect.arrayContaining([expect.objectContaining({ sourceId: "zfh", note: "persisted source note" })]),
    postings: expect.arrayContaining([expect.objectContaining({ postingId: "zfh::REQ-1", sourcePostingKey: "REQ-1" })]),
    lineageEdges: [expect.objectContaining({ fromPostingId: "zfh::REQ-OLD", toPostingId: "zfh::REQ-1", fromObservationId: "old", toObservationId: "new", algorithmVersion: "repost-v1" })],
  });
});

test("job detail keeps a possible repost as an inference separate from field diffs", async () => {
  const db = createDatabase(":memory:");
  const base = { sourceId: "zfh", sourceUrl: "https://example.test/jobs", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs with TypeScript", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any;
  saveObservation(db, { ...base, observationId: "obs-old", observedAt: "2026-08-19T00:00:00.000Z" });
  saveObservation(db, { ...base, observationId: "obs-new", observedAt: "2026-08-20T00:00:00.000Z" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/jobs/obs-new"));
  expect(await response.json()).toMatchObject({ inferences: [expect.objectContaining({ type: "possible_repost", observationIds: ["obs-old", "obs-new"] })] });
});

test("summary exposes lifecycle state separately from reciprocity analysis", async () => {
  const db = createDatabase(":memory:");
  const base = { sourceId: "zfh", sourceUrl: "https://example.test/jobs", sourceJobId: "REQ-1", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any;
  saveObservation(db, { ...base, observationId: "obs-old", observedAt: "2026-08-19T00:00:00.000Z" });
  saveObservation(db, { ...base, observationId: "obs-new", closingDate: "2026-09-01", observedAt: "2026-08-20T00:00:00.000Z" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  const body = await response.json();
  expect(body.analyses.find((analysis: { observationId: string }) => analysis.observationId === "obs-new")).toMatchObject({ lifecycleState: "MEANINGFULLY_UPDATED" });
});

test("summary exposes freshness evidence without inventing a publish date", async () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-relative", sourceId: "visa", sourceUrl: "https://example.test/jobs", title: "Backend", postedDate: null, postedDateQuality: "relative", observedAt: "2026-08-20T00:00:00.000Z", provenance: { postedDate: { raw: "30+ Days Ago", kind: "relative" } }, sourceConfidence: 1 } as any);
  const response = await createAppServer(db).fetch(new Request("http://local/api/summary"));
  const analysis = (await response.json()).analyses[0];
  expect(analysis.freshness).toMatchObject({ precision: "lower_bound", sourcePublishedAt: null, ageMinDays: 30 });
});

test("compare endpoint returns two jobs with independent signal dimensions", async () => {
  const db = createDatabase(":memory:");
  const base = { sourceId: "demo-controlled", sourceUrl: "https://fixture.applysignal.test/jobs", title: "Role", location: "Remote", description: "Build APIs", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 0.8 } as any;
  saveObservation(db, { ...base, observationId: "left", observedAt: "2026-08-19T00:00:00.000Z" });
  saveObservation(db, { ...base, observationId: "right", title: "Role 2", observedAt: "2026-08-20T00:00:00.000Z" });
  const response = await createAppServer(db).fetch(new Request("http://local/api/compare?left=left&right=right"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    dimensions: ["freshness", "transparency", "application_burden", "lifecycle", "source_confidence"],
    left: { observationId: "left", analysis: { freshness: expect.any(Object), transparencyScore: expect.any(Number), transparencySignals: expect.any(Array) } },
    right: { observationId: "right", analysis: { freshness: expect.any(Object), transparencyScore: expect.any(Number), transparencySignals: expect.any(Array) } },
  });
});

test("compare endpoint rejects missing or unknown observations", async () => {
  const server = createAppServer(createDatabase(":memory:"));
  expect((await server.fetch(new Request("http://local/api/compare?left=a"))).status).toBe(400);
  expect((await server.fetch(new Request("http://local/api/compare?left=a&right=b"))).status).toBe(404);
});

test("dashboard includes the candidate compare surface", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/"));
  const body = await response.text();
  expect(body).toContain("WHERE SHOULD I SPEND");
  const script = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const scriptBody = await script.text();
  expect(scriptBody).toContain("/api/compare");
  expect(scriptBody).toContain("APPLICATION BURDEN");
});

test("job detail exposes persisted lifecycle events as history evidence", async () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-after", sourceId: "zfh", sourceUrl: "https://example.test/jobs", title: "Backend", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any);
  savePostingEvent(db, { sourceId: "zfh", eventType: "NEWLY_OBSERVED", beforeObservationId: null, afterObservationId: "obs-after", observedAt: "2026-08-20T00:00:00.000Z", evidence: { changes: [] } });
  const response = await createAppServer(db).fetch(new Request("http://local/api/jobs/obs-after"));
  expect(await response.json()).toMatchObject({ events: [expect.objectContaining({ eventType: "NEWLY_OBSERVED", afterObservationId: "obs-after", postingId: "zfh::obs-after", afterPostingId: "zfh::obs-after" })] });
});

test("job detail exposes persisted lineage edges for the selected observation", async () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-old", sourceId: "zfh", sourceJobId: "REQ-OLD", title: "Backend", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any);
  saveObservation(db, { observationId: "obs-new", sourceId: "zfh", title: "Backend", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any);
  saveInference(db, { type: "possible_repost", confidence: 0.9, signals: ["same title"], observationIds: ["obs-old", "obs-new"] });
  const response = await createAppServer(db).fetch(new Request("http://local/api/jobs/obs-new"));
  expect(await response.json()).toMatchObject({ lineageEdges: [expect.objectContaining({ fromObservationId: "obs-old", toObservationId: "obs-new", relation: "possible_repost" })] });
});

test("job detail UI labels persisted lifecycle events separately from inferences", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("PERSISTED LIFECYCLE EVENTS");
  expect(body).toContain("PERSISTED LINEAGE EDGES");
});

test("job detail exposes the structured application observation", async () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-application", sourceId: "zfh", title: "Backend", postedDateQuality: "unavailable", closingDateQuality: "unavailable", provenance: {}, sourceConfidence: 1 } as any);
  saveApplicationObservation(db, "obs-application", {
    formUrl: "https://example.test/jobs/backend/apply",
    accountGate: true,
    resumeRequired: true,
    requiredFieldCount: 1,
    optionalFieldCount: 0,
    unknownFieldCount: 0,
    customQuestionCount: 0,
    longAnswerCount: 0,
    attachmentCount: 1,
    manualHistoryFields: [],
  });
  const response = await createAppServer(db).fetch(new Request("http://local/api/jobs/obs-application"));
  expect(await response.json()).toMatchObject({ applicationObservation: { formUrl: "https://example.test/jobs/backend/apply", accountGate: true, resumeRequired: true, attachmentCount: 1 } });
});

test("job detail UI labels the public application observation summary", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain("APPLICATION OBSERVATION");
  expect(body).toContain("PUBLIC FORM");
  expect(body).toContain("LONG ANSWERS");
});

test("job detail UI distinguishes optional application fields from unknown fields", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/app.js"));
  const body = await response.text();
  expect(body).toContain('field.required === false ? "(optional)"');
});
