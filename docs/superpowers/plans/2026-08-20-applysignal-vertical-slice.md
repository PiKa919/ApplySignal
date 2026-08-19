# ApplySignal Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested local ApplySignal vertical slice that ingests Bright Data-shaped observations, separates facts from inferences, computes the Reciprocity Gap, persists lifecycle history, and serves a judge-ready evidence-focused dashboard.

**Architecture:** A Bun + TypeScript application owns domain types, normalization, deterministic analysis, SQLite persistence, and a small HTTP API. A Bright Data adapter invokes the authenticated CLI only at the collection boundary and stores raw run artifacts before normalization. The UI consumes the API and clearly labels fixture, live, inferred, unknown, and source-confidence states.

**Tech Stack:** Bun, TypeScript, Bun test runner, built-in `bun:sqlite`, built-in `fetch`/`Bun.serve`, vanilla HTML/CSS/TypeScript UI, Bright Data CLI 0.3.x.

## Global Constraints

- Bright Data Scraper Studio is the collection boundary and must be central to live collection.
- Live collection uses only public career-site data.
- Marketplace/library preflight must happen before finalizing targets; covered targets are excluded from the hero source set.
- Freshness, transparency, application burden, lifecycle, and source confidence remain separate outputs.
- Observations are facts; repost/continuation relationships are explicitly labeled inferences.
- Missing information is `unknown`, never silently converted to a negative fact.
- No login-protected application automation, fake employer history, or universal composite employer score.
- Use Bun commands for JavaScript/TypeScript package management and scripts.
- Every behavior change follows a failing-test-first red/green/refactor cycle.

---

### Task 1: Establish the Bun application shell and test command

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `tests/smoke.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces `bun test` as the project test command.
- Produces a `src/index.ts` entrypoint that can later start the HTTP server without importing browser-only code.

- [ ] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, test } from "bun:test";

describe("project shell", () => {
  test("exposes a stable application name", async () => {
    const { APP_NAME } = await import("../src/index");
    expect(APP_NAME).toBe("ApplySignal");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/smoke.test.ts`

Expected: FAIL because `src/index.ts` does not exist.

- [ ] **Step 3: Add the minimal shell**

```ts
export const APP_NAME = "ApplySignal";
```

Create `package.json` with scripts `{ "test": "bun test", "dev": "bun run src/index.ts" }`, a strict `tsconfig.json`, and `.gitignore` entries for `node_modules`, `.env`, `data/*.db`, and `artifacts/`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/smoke.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/index.ts tests/smoke.test.ts .gitignore
git commit -m "chore: establish Bun application shell"
```

### Task 2: Define observation facts and normalize raw collector rows

**Files:**
- Create: `src/domain/observations.ts`
- Create: `src/domain/normalize.ts`
- Create: `tests/domain/normalize.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- `normalizeJobObservation(input: RawJobRow, context: NormalizationContext): JobObservation`
- `JobObservation` includes `observationId`, `sourceId`, `sourceUrl`, `observedAt`, `title`, `location`, `employmentType`, `postedDate`, `postedDateQuality`, `closingDate`, `description`, `applicationUrl`, `provenance`, and `sourceConfidence`.
- Date quality is one of `exact | relative | unavailable`.
- Missing scalar values are `null`, never fabricated.

- [ ] **Step 1: Write failing normalization tests**

```ts
import { describe, expect, test } from "bun:test";
import { normalizeJobObservation } from "../../src/domain/normalize";

describe("normalizeJobObservation", () => {
  test("preserves a relative posting date as relative evidence", () => {
    const result = normalizeJobObservation({
      source_job_id: "R-42",
      title: "Backend Engineer",
      location: "Bengaluru",
      posted_date: "30+ Days Ago",
      description: "Build APIs",
      url: "https://example.test/jobs/R-42",
    }, { sourceId: "visa", sourceUrl: "https://example.test/jobs", observedAt: "2026-08-20T00:00:00.000Z" });

    expect(result.postedDate).toBe(null);
    expect(result.postedDateQuality).toBe("relative");
    expect(result.provenance.postedDate).toEqual({ raw: "30+ Days Ago", kind: "relative" });
  });

  test("keeps undisclosed salary unknown instead of inferring zero", () => {
    const result = normalizeJobObservation({ title: "Designer", url: "https://example.test/designer" }, {
      sourceId: "zfh", sourceUrl: "https://example.test/jobs", observedAt: "2026-08-20T00:00:00.000Z",
    });

    expect(result.salary).toBe(null);
    expect(result.provenance.salary).toEqual({ kind: "unknown" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/domain/normalize.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement the minimal types and normalizer**

Define `RawJobRow` with optional snake_case fields, normalize whitespace and URLs, parse only ISO dates, classify strings containing `day`, `hour`, or `week` as relative, and retain each raw value in field-level provenance. Do not calculate any employer score in this module.

- [ ] **Step 4: Run focused and full tests**

Run: `bun test tests/domain/normalize.test.ts && bun test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain tests/domain src/index.ts
git commit -m "feat: normalize job observations with provenance"
```

### Task 3: Model application burden and Reciprocity Gap analysis

**Files:**
- Create: `src/domain/reciprocity.ts`
- Create: `tests/domain/reciprocity.test.ts`

**Interfaces:**
- `analyzeReciprocity(job: JobObservation, fields: ApplicationFieldObservation[]): ReciprocityAnalysis`
- `ReciprocityAnalysis` contains `disclosedCategories`, `requestedCategories`, `gapLabel`, `explanation`, and independent counts; it does not expose a universal score.
- Categories are `role | location | experience | responsibilities | skills | compensation | deadline | process | identity | compensation_history | availability | education | employment_history | resume`.

- [ ] **Step 1: Write the failing analysis test**

```ts
import { expect, test } from "bun:test";
import { analyzeReciprocity } from "../../src/domain/reciprocity";

test("labels high application burden with low disclosure as information asymmetry", () => {
  const result = analyzeReciprocity({
    title: "Backend Engineer",
    location: "Bengaluru",
    description: "Responsibilities and 5-7 years experience",
    compensation: null,
  } as any, [
    { label: "Current CTC", category: "compensation_history", required: true },
    { label: "Expected CTC", category: "compensation_history", required: true },
    { label: "Notice period", category: "availability", required: true },
  ]);

  expect(result.gapLabel).toBe("information asymmetry");
  expect(result.explanation).toContain("compensation");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/domain/reciprocity.test.ts`

Expected: FAIL because the analyzer does not exist.

- [ ] **Step 3: Implement deterministic category extraction**

Map only explicit job fields and application labels. Count requested fields separately from disclosed categories. Use thresholds based on counts: `balanced`, `demanding but transparent`, `low information`, and `information asymmetry`; include a human-readable explanation naming missing disclosure categories and requested burden categories.

- [ ] **Step 4: Run focused and full tests**

Run: `bun test tests/domain/reciprocity.test.ts && bun test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/reciprocity.ts tests/domain/reciprocity.test.ts
git commit -m "feat: compute explainable Reciprocity Gap"
```

### Task 4: Add lifecycle diffs and bounded repost inferences

**Files:**
- Create: `src/domain/lifecycle.ts`
- Create: `tests/domain/lifecycle.test.ts`

**Interfaces:**
- `diffObservations(previous: JobObservation, current: JobObservation): ObservationDiff`
- `inferPostingRelationship(a: JobObservation, b: JobObservation): PostingInference | null`
- `ObservationDiff` records field-level changes and disappearance/reappearance-ready status.
- `PostingInference` contains `type`, `confidence`, `signals`, and `observationIds`; it never creates a shared vacancy ID.

- [ ] **Step 1: Write failing tests for factual diffs and non-factual inference**

```ts
import { expect, test } from "bun:test";
import { diffObservations, inferPostingRelationship } from "../../src/domain/lifecycle";

test("reports a changed closing date as a field fact", () => {
  const before = { observationId: "a", title: "Backend", closingDate: null } as any;
  const after = { observationId: "b", title: "Backend", closingDate: "2026-09-01" } as any;
  expect(diffObservations(before, after).changes).toEqual([{ field: "closingDate", before: null, after: "2026-09-01" }]);
});

test("returns a possible repost inference without merging observations", () => {
  const a = { observationId: "a", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs" } as any;
  const b = { observationId: "b", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs" } as any;
  const result = inferPostingRelationship(a, b);
  expect(result?.type).toBe("possible_repost");
  expect(result?.observationIds).toEqual(["a", "b"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/domain/lifecycle.test.ts`

Expected: FAIL because the lifecycle module does not exist.

- [ ] **Step 3: Implement diffs and conservative inference**

Compare only declared fields. Generate `possible_repost` only when normalized title and location match and description similarity exceeds a fixed threshold; return confidence and signals. Never mutate either observation.

- [ ] **Step 4: Run focused and full tests**

Run: `bun test tests/domain/lifecycle.test.ts && bun test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/lifecycle.ts tests/domain/lifecycle.test.ts
git commit -m "feat: track lifecycle diffs and repost hypotheses"
```

### Task 5: Persist runs, observations, fields, and inferences in SQLite

**Files:**
- Create: `src/storage/database.ts`
- Create: `src/storage/repository.ts`
- Create: `tests/storage/repository.test.ts`

**Interfaces:**
- `createDatabase(path: string): Database`
- `saveScrapeRun(db, run): void`
- `saveObservation(db, observation): void`
- `listLatestObservations(db, sourceId?: string): JobObservation[]`
- `saveApplicationFields(db, observationId, fields): void`
- `saveInference(db, inference): void`

- [ ] **Step 1: Write failing persistence tests**

```ts
import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { listLatestObservations, saveObservation } from "../../src/storage/repository";

test("round-trips observations without collapsing unknown fields", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-1", sourceId: "zfh", title: "Designer", location: null, salary: null } as any);
  expect(listLatestObservations(db, "zfh")[0]).toMatchObject({ observationId: "obs-1", salary: null });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/storage/repository.test.ts`

Expected: FAIL because storage modules do not exist.

- [ ] **Step 3: Implement schema and repository**

Create tables for `scrape_runs`, `job_observations`, `application_fields`, and `posting_inferences`; store provenance and raw payload references as JSON text; enable foreign keys; use parameterized statements only.

- [ ] **Step 4: Run focused and full tests**

Run: `bun test tests/storage/repository.test.ts && bun test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage tests/storage
git commit -m "feat: persist ApplySignal observations"
```

### Task 6: Add Bright Data CLI adapter and fixture ingestion boundary

**Files:**
- Create: `src/collectors/brightdata.ts`
- Create: `src/collectors/ingest.ts`
- Create: `src/collectors/fixtures/zfh-jobs.json`
- Create: `tests/collectors/ingest.test.ts`
- Create: `.env.example`

**Interfaces:**
- `runBrightDataCollector(request: CollectorRequest): Promise<CollectorRunResult>`
- `ingestCollectorResult(db, result): IngestSummary`
- `CollectorRunResult` always includes `rawOutput`, `collectorId`, `sourceId`, `observedAt`, `status`, and `rows`.

- [ ] **Step 1: Write failing ingestion tests**

```ts
import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { ingestCollectorResult } from "../../src/collectors/ingest";

test("rejects a successful-looking collector result with silent cardinality loss", () => {
  const db = createDatabase(":memory:");
  expect(() => ingestCollectorResult(db, {
    collectorId: "c_test", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z",
    status: "success", rawOutput: "[]", rows: [], expectedMinimumRows: 1,
  } as any)).toThrow("cardinality");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/collectors/ingest.test.ts`

Expected: FAIL because the ingestion boundary does not exist.

- [ ] **Step 3: Implement the adapter and fixture boundary**

Invoke `brightdata scraper run <collector_id> [url] --format json` through `Bun.spawn`, reject non-zero exit status, preserve stdout/stderr, parse JSON rows, and never print API keys. `ingestCollectorResult` validates minimum cardinality, saves the run and normalized observations, and marks fixture rows as `dataMode: "fixture"`. Add `.env.example` with non-secret collector/source placeholders only.

- [ ] **Step 4: Run focused and full tests**

Run: `bun test tests/collectors/ingest.test.ts && bun test`

Expected: all tests PASS without requiring Bright Data authentication.

- [ ] **Step 5: Commit**

```bash
git add src/collectors tests/collectors .env.example
git commit -m "feat: add Bright Data collector boundary"
```

### Task 7: Serve the evidence-focused dashboard

**Files:**
- Create: `src/server.ts`
- Create: `src/ui/index.html`
- Create: `src/ui/styles.css`
- Create: `src/ui/app.ts`
- Create: `tests/server.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- `createAppServer(db): { fetch(request: Request): Response | Promise<Response> }`
- `GET /api/summary` returns source health, observation counts, and data-mode labels.
- `GET /api/jobs` returns normalized observations plus Reciprocity Gap analysis.
- `GET /api/jobs/:id` returns evidence, application fields, lifecycle diffs, inferences, and source confidence.

- [ ] **Step 1: Write failing API tests**

```ts
import { expect, test } from "bun:test";
import { createDatabase } from "../src/storage/database";
import { createAppServer } from "../src/server";

test("summary endpoint exposes source confidence separately from job analysis", async () => {
  const response = await createAppServer(createDatabase(":memory:")).fetch(new Request("http://local/api/summary"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ sourceConfidence: expect.any(Array), analyses: expect.any(Array) });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/server.test.ts`

Expected: FAIL because the server module does not exist.

- [ ] **Step 3: Implement API and UI**

Serve the static dashboard and JSON endpoints. The page must show separate cards for freshness, transparency, application burden, lifecycle, and source confidence; a job detail panel with evidence URLs and raw labels; a Reciprocity Gap explanation; and visible `fixture`, `live`, `inferred`, and `unknown` badges. Avoid a single aggregate score.

- [ ] **Step 4: Run focused and full tests**

Run: `bun test tests/server.test.ts && bun test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/ui tests/server.test.ts src/index.ts
git commit -m "feat: serve ApplySignal evidence dashboard"
```

### Task 8: Authenticate, preflight targets, and capture a live Bright Data run

**Files:**
- Create: `docs/evidence/brightdata-preflight.md`
- Create: `docs/evidence/live-run-YYYY-MM-DD.md`
- Modify: `src/collectors/fixtures/zfh-jobs.json` only if the live schema reveals a documented normalization case.

**Interfaces:**
- No application API changes; this task records external evidence and source configuration.

- [ ] **Step 1: Authenticate without writing secrets to the repository**

Run: `brightdata login` or set `BRIGHTDATA_API_KEY` in the shell environment. Verify with `brightdata zones` and record only the non-secret success/failure state.

- [ ] **Step 2: Preflight each candidate in the authenticated Marketplace/library**

Check Visa, Cadence, BrowserStack, Meesho, Zerodha Fund House, CRED, Postman, and Razorpay. Record the lookup result, whether a suitable prebuilt scraper exists, and the keep/replace decision. Do not use a covered target as the hero custom scraper.

- [ ] **Step 3: Create the custom Scraper Studio collector**

Use a natural-language schema covering listing URL, source ID, title, location, employment type, posted/closing date text, description, application URL, and extraction status. Save the collector ID in local configuration only.

- [ ] **Step 4: Run and validate one live collection**

Run the collector through the CLI, save redacted raw output and run metadata under ignored artifacts, ingest the rows, verify minimum cardinality and required-field coverage, and launch the local dashboard against the resulting SQLite database.

- [ ] **Step 5: Record self-healing evidence**

Demonstrate a controlled field/schema failure, invoke `brightdata scraper heal <collector_id> <prompt>`, approve only after reviewing the diff, rerun the collector, and record before/after output plus the explicit approval state.

- [ ] **Step 6: Commit documentation only**

```bash
git add docs/evidence
git commit -m "docs: record Bright Data preflight and live run"
```

## Plan self-review

- Spec coverage: the plan covers Bright Data collection and healing, public-data boundary, source confidence, observations, application burden, Reciprocity Gap, lifecycle facts/inferences, validation, persistence, UI, and tests. Final multi-source expansion is intentionally represented by repeatable Task 8 preflight/run cycles after the vertical slice.
- Placeholder scan: no `TODO`, `TBD`, or vague implementation step is used; candidate source names are explicitly marked as preflight-dependent rather than pretending to be final.
- Type consistency: `JobObservation`, `ApplicationFieldObservation`, `PostingInference`, `CollectorRunResult`, and the API paths are defined at their first use and reused consistently.
