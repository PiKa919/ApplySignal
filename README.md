# ApplySignal

ApplySignal is candidate-side career intelligence for the Scrape-Verse hackathon. It compares what an employer discloses in a public listing with what the public application flow asks from a candidate.

The product keeps these signals separate:

- freshness
- transparency
- application burden
- lifecycle changes
- source confidence

The dashboard includes a side-by-side Compare surface for deciding where to spend application time. It shows freshness, explainable transparency, application burden, lifecycle, and source confidence independently; it does not calculate a universal “worth applying” score.

Its central view is the Reciprocity Gap: an explainable comparison between disclosed categories and requested application fields. A possible repost is an inference between two observations; it is never treated as proof that two postings represent one vacancy.

Application analysis also exposes a Resume Re-entry Tax: the count and severity of public employment, education, compensation-history, experience, and current-employer fields requested in addition to a resume.

The application detail view also stores a structured public-form observation: the public form evidence URL, account-gate state when observable, resume requirement, required/optional/unknown counts, custom-question and long-answer counts, attachments, and deduplicated manual-history labels. It never stores candidate-entered values. The current Zerodha application observation is documented in `docs/evidence/application-observation-2026-08-20.md`.

Stable posting records own cross-observation history. Version-specific observations, lifecycle events, analysis snapshots, and possible-repost lineage retain their observation IDs as evidence while linking back to the stable posting ID; inferred lineage never merges or rewrites observed facts.

The persisted source registry also keeps source family, the evidenced Bright Data collector ID, and oracle metadata separate from free-form notes, so the Source Health surface can show what is configured versus what is actually live.

Posting flags distinguish `TALENT_POOL`, `EXPLICIT_EVERGREEN`, and `EVERGREEN_LIKE` patterns. These are deterministic labels from observed title/description text, not claims that an ordinary listing is stale, fraudulent, or a single vacancy.

## Run locally

Requires Bun.

```bash
bun test
bun run seed:fixture
bun run dev
```

Open <http://localhost:3000>.

The fixture command writes `data/applysignal.db`, which is ignored by Git. It seeds the public-source snapshot plus separate, clearly labeled `demo-lifecycle` and `demo-controlled` sources. The controlled source contains six edge cases: a fresh role, a relative-date role, explicit evergreen hiring, a talent-pool posting, a multi-location role, and a rich public application form. It supports two semantically equivalent layouts to exercise extraction resilience:

```bash
APPLYSIGNAL_FIXTURE_LAYOUT=layout-b bun run seed:fixture
```

`layout-a` is the default card-shaped representation; `layout-b` is a definition-list-like representation that is canonicalized into the same six job facts. The rich application fields are public labels only, never candidate values. Fixture observations are visibly labeled in the dashboard. Details are documented in `docs/evidence/controlled-fixture.md`.

## Bright Data workflow

The live collector boundary is `src/collectors/brightdata.ts`. Credentials are supplied through the Bright Data CLI, never committed to this repository.

```bash
brightdata login
brightdata zones
BRIGHTDATA_COLLECTOR_ID=<collector-id> \
BRIGHTDATA_SOURCE_ID=zfh \
BRIGHTDATA_SOURCE_URL=https://careers.zerodhafundhouse.com/jobs \
BRIGHTDATA_TARGET_URL=https://careers.zerodhafundhouse.com/jobs \
BRIGHTDATA_REQUIRED_FIELDS=source_job_id,title,location \
BRIGHTDATA_IDENTITY_FIELD=source_job_id \
BRIGHTDATA_EXPECTED_HOST=careers.zerodhafundhouse.com \
BRIGHTDATA_MIN_COVERAGE=0.75 \
bun run run:collector
```

For a public application form, use the separate bounded command. It shares the cooldown ledger, records `runKind: application`, redacts raw output, and attaches only visible field metadata to an existing observation:

```bash
BRIGHTDATA_APPLICATION_COLLECTOR_ID=<application-collector-id> \
BRIGHTDATA_APPLICATION_SOURCE_ID=zfh \
BRIGHTDATA_APPLICATION_TARGET_URL=https://careers.example.com/jobs/role/apply \
BRIGHTDATA_APPLICATION_OBSERVATION_ID=<existing-observation-id> \
bun run run:application
```

The first live collector was created in Scraper Studio for Zerodha Fund House. The live run returned 13 listing observations. A second Scraper Studio collector inspected the public Senior Backend Engineer application form and returned 17 visible fields without submitting the form or collecting candidate values. The Palantir Lever fallback collector completed through a Bright Data batch handoff and returned 307 public listing observations. Razorpay returned 26 rows from its direct Greenhouse board, and Visa now has one explicitly scoped live Workday detail observation. `run:collector` applies the zero-credit public preflight and cooldown before any paid call, then applies the minimum-row cardinality guard and persists the run before the dashboard reads it.

`run:application` applies the same cooldown and zero-credit public preflight by default. An application target that returns a block, redirect mismatch, HTTP error, or unreachable result is skipped with `brightDataCalls: 0`; `APPLYSIGNAL_PREFLIGHT_MODE=disabled` is required to deliberately bypass that check.

The approved self-healing run added `closing_date_text`, returned `null` when no public deadline was visible, and preserved the existing listing fields. Evidence is documented in `docs/evidence/`.

## Oracle validation

When a source has an independent public ATS representation, compare cached scraper and oracle job IDs locally with `compareJobIds` from `src/domain/validation.ts`. The result records deduplicated counts, matched IDs, missing and unexpected IDs, and an explicit `agree`, `mismatch`, or `insufficient_data` status. Results are persisted separately from collector health and exposed through `/api/summary`; no additional Bright Data request is needed to repeat a comparison.

## Product screens

- **Explorer:** browse observations with freshness, Reciprocity Gap, lifecycle, and source-confidence signals kept independent.
- **Compare:** inspect two observations side by side before spending application time.
- **Job Evidence:** expand source URLs, raw provenance, application burden, structured changes, and bounded inferences.
- **Source Health:** inspect catalog scope, run status, quarantine evidence, validation results, and last-known-good boundaries.

The dashboard deliberately avoids a universal “worth applying” score. An old listing is not automatically fraudulent, a difficult application is not automatically bad, and scraper confidence is not an employer attribute.

The recommended recording path is [`docs/evidence/demo-runbook.md`](docs/evidence/demo-runbook.md). It uses the existing evidence and the credit-free fault-injection demo; it does not imply that unresolved targets have healthy collectors.

## Structured output

The public application observation contract is illustrated in [`docs/evidence/example-structured-output.json`](docs/evidence/example-structured-output.json). The domain model stores aggregate form metadata and visible labels only; it does not store candidate-entered values. The live Zerodha example is documented in [`docs/evidence/application-observation-2026-08-20.md`](docs/evidence/application-observation-2026-08-20.md).

## Reliability and self-healing

The pipeline is intentionally ordered:

```text
Bright Data run → transport/structural/semantic health gate
  → quarantine on failure → retain last-known-good observations
  → review-gated diagnosis → human-reviewed heal preview
  → approved rerun → validate → commit
```

`buildHealDiagnosis` generates a field-specific prompt from observed drift but never invokes `brightdata scraper heal`, approves a preview, or reruns a paid job automatically. The current evidence is in [`docs/evidence/health-contract.md`](docs/evidence/health-contract.md) and [`docs/evidence/heal-diagnosis.md`](docs/evidence/heal-diagnosis.md).

The explicit review-gated bridge is `bun run heal:collector`: preview mode calls Bright Data heal without auto-approval or auto-save and records `approved: null`; approval requires `APPLYSIGNAL_APPROVE_HEAL=true`. The repaired collector is rerun separately through the normal cooldown/health-gated collector path.

The credit-free fault-injection demo can be reproduced with `bun run demo:health`. It uses the controlled fixture, removes rows and a location field, then writes `artifacts/applysignal-health-demo.json`. The artifact shows the healthy baseline, quarantined current run, retained last-known-good decision, field-specific review prompt, `approvalRequired: true`, `brokenRunCommitted: false`, and `brightDataCalls: 0`. It does not contact Bright Data.

## Edge cases and limitations

The supported edge-case contract is listed in [`docs/edge-cases.md`](docs/edge-cases.md). Live coverage is not claimed for unresolved or failed-generation targets; the source catalog exposes those states explicitly. Greenhouse/Lever representations are validation or fallback sources, not proof that every branded target is scrapeable.

## AI use disclosure

Bright Data Scraper Studio is used to generate and approve collector code, including the demonstrated self-healing repair. ApplySignal's normalization, Reciprocity Gap labels, lifecycle diffs, and bounded repost inferences are deterministic application code. The system does not use an LLM to invent employer facts, collect candidate values, or submit applications.

Codex/ChatGPT was used for development assistance, debugging, implementation review, and test generation. Architecture decisions, collector behavior, validation rules, and submitted code remain participant-reviewed. Bright Data Scraper Studio's AI workflow was used at the collector boundary, including the documented review-gated healing flow.

## Hosted demo

The recommended deployment target is Render because ApplySignal is a Bun HTTP server with a SQLite-backed local snapshot. [`render.yaml`](render.yaml) and [`Dockerfile`](Dockerfile) provide a direct Docker deployment; the hosted container seeds the controlled fixture so the public demo has deterministic evidence without publishing the local live database. Vercel would require a serverless adapter and a different persistence strategy.

The repository includes two GitHub Actions workflows:

- `ApplySignal CI` runs tests, builds, the credit-free health demo, fixture audit, and formatting checks on pushes and pull requests.
- `Bright Data collector` is manual-only. It defaults to ordinary HTTP preflight and requires both the exact `RUN_PAID_COLLECTION` confirmation and the `BRIGHTDATA_API_KEY` repository secret before a paid collector run can occur. Configure a `brightdata-paid` environment if reviewer approval is desired.

## Demo walkthrough

The repository also includes a short fixture-only UI walkthrough: [download the ApplySignal demo video](artifacts/applysignal-demo-2026-08-20.mp4). It shows the overview, Job Evidence, Source Health, and Compare surfaces without exposing credentials or candidate data.

## Contributors

- Ankit Das (PiKa919)

## Credit-aware collection policy

Collector creation and live runs are paid external actions. The project keeps one completed collector per target, prefers scoped detail pages or small boards when full-board generation is unreliable, applies a minimum-row guard, and does not rerun a target solely for confirmation. A run handed to Bright Data batch mode is treated as pending until output is returned; it is not retriggered automatically after a local poll is stopped.

The collector CLI skips any recent run for the same collector/source within the default 24-hour cooldown before invoking Bright Data. Successful runs report `recent_success`; failed or quarantined runs report `recent_failure`. After cooldown permits a run, it performs the ordinary HTTP preflight against `BRIGHTDATA_TARGET_URL` and skips the paid call for an invalid URL, redirect mismatch, HTTP error, block page, or unreachable target. These skips include the preflight evidence and `brightDataCalls: 0`. Set `BRIGHTDATA_COOLDOWN_HOURS=0` for a deliberate no-cooldown run, or set `APPLYSIGNAL_FORCE_PAID_RUN=true` when an explicit rerun is justified.

Ingestion applies a structural, semantic, and distributional health gate after envelope expansion: minimum cardinality, required-field coverage, duplicate identity/URL detection, expected URL-host checks, pagination evidence when supplied, scope-aware empty-state checks, obvious title/location swaps, invalid salary ranges, impossible exact date ordering, and category distributions. A suspicious result is persisted as `quarantined` with its health report and produces no job observations. `compareDistributionalHealth` reports baseline drift as review evidence; distribution changes do not trigger automatic healing by themselves.

The collector CLI passes `BRIGHTDATA_REQUIRED_FIELDS`, `BRIGHTDATA_IDENTITY_FIELD`, `BRIGHTDATA_EXPECTED_HOST`, and `BRIGHTDATA_MIN_COVERAGE` into that contract. Optional transport evidence can also quarantine navigation failures, non-success HTTP responses, unexpected final hosts, empty bodies, or explicit block/CAPTCHA indicators. When transport evidence is unavailable from a collector output, the report records `transportStatus: unknown`; it does not infer transport success from row presence alone.

Before a paid collector attempt, run the zero-credit public preflight when a target URL is known:

```bash
APPLYSIGNAL_PREFLIGHT_SOURCE_ID=browserstack \
APPLYSIGNAL_PREFLIGHT_URL=https://browserstack.wd3.myworkdayjobs.com/External \
bun run preflight
```

The preflight checks reachability and block/redirect evidence only; a reachable page is not treated as a successful collector.

`run:collector` requires this preflight by default. It also refuses catalog sources marked `unresolved` or `failed_generation` before making any network or Bright Data call. A deliberate operator retry must set `APPLYSIGNAL_ALLOW_UNRESOLVED_SOURCE=true`; this override is separate from the preflight bypass. For a target that is intentionally inaccessible to ordinary HTTP but has a separately reviewed Bright Data path, set `APPLYSIGNAL_PREFLIGHT_MODE=disabled` explicitly; the command logs that bypass before making the paid call. The defaults should remain `required` and `false`.

The authenticated CLI's `pipelines list` output is not the Scrapers Library. The CLI has no Marketplace/library search command, so the repository records the limitation explicitly in [`docs/evidence/brightdata-preflight.md`](docs/evidence/brightdata-preflight.md) and does not claim that a pipeline-list result proves library absence.

When a baseline/current distribution comparison requires review, `buildHealDiagnosis` in `src/collectors/health.ts` generates a field-specific, review-gated prompt containing the affected coverage changes and record-count drift. It explicitly preserves the existing output schema and requires human approval after preview validation. It does not invoke `brightdata scraper heal`, approve a collector, or rerun a paid job.

Every catalog entry also declares its observation scope (`all_jobs`, `subset`, or `talent_pool`, plus geography and career filters). Health and cardinality claims are interpreted within that scope; a scoped zero is not treated as a failed full-board scrape.

Successful ingestion also appends a `posting_events` record for each observation. These records preserve lifecycle state, before/after observation IDs, and structured field-change evidence separately from the raw observation facts and possible-repost inferences.

## Evidence boundary

Live and fixture data are separate. Missing salary, deadlines, or application fields remain unknown; they are not converted to negative claims. The app does not submit applications or access login-protected data.

## Project map

- `src/domain/`: observation normalization, Reciprocity Gap analysis, lifecycle diffs, and bounded inferences
- `src/collectors/`: Bright Data adapter, cardinality guard, fixture ingestion, and application-field ingestion
- `src/collectors/fixtures/controlled-career-site.json`: deterministic six-case, two-layout fault-injection fixture
- `src/storage/`: SQLite schema and repositories
- `src/server.ts`: JSON API and static dashboard server
- `src/ui/`: evidence-focused dashboard, job evidence, source health, and candidate Compare surface
- `docs/superpowers/`: approved design and implementation plan
- `docs/evidence/`: Bright Data preflight and live-run records
- `docs/evidence/submission-readiness.md`: plan-gate audit and defensible submission framing
- `docs/evidence/analysis-snapshots.md`: versioned persistence and read-through behavior for derived analyses
