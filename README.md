# ApplySignal

ApplySignal is candidate-side career intelligence for the Scrape-Verse hackathon. It compares what an employer discloses in a public listing with what the public application flow asks from a candidate.

The product keeps these signals separate:

- freshness
- transparency
- application burden
- lifecycle changes
- source confidence

The dashboard includes a side-by-side Compare surface for deciding where to spend application time. It shows freshness, disclosed-category transparency, application burden, lifecycle, and source confidence independently; it does not calculate a universal “worth applying” score.

Its central view is the Reciprocity Gap: an explainable comparison between disclosed categories and requested application fields. A possible repost is an inference between two observations; it is never treated as proof that two postings represent one vacancy.

Application analysis also exposes a Resume Re-entry Tax: the count and severity of public employment, education, compensation-history, experience, and current-employer fields requested in addition to a resume.

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

The first live collector was created in Scraper Studio for Zerodha Fund House. The live run returned 13 listing observations. A second Scraper Studio collector inspected the public Senior Backend Engineer application form and returned 17 visible fields without submitting the form or collecting candidate values. The Palantir Lever fallback collector completed through a Bright Data batch handoff and returned 307 public listing observations. Razorpay returned 26 rows from its direct Greenhouse board, and Visa now has one explicitly scoped live Workday detail observation. `run:collector` applies the minimum-row cardinality guard and persists the run before the dashboard reads it.

The approved self-healing run added `closing_date_text`, returned `null` when no public deadline was visible, and preserved the existing listing fields. Evidence is documented in `docs/evidence/`.

## Oracle validation

When a source has an independent public ATS representation, compare cached scraper and oracle job IDs locally with `compareJobIds` from `src/domain/validation.ts`. The result records deduplicated counts, matched IDs, missing and unexpected IDs, and an explicit `agree`, `mismatch`, or `insufficient_data` status. Results are persisted separately from collector health and exposed through `/api/summary`; no additional Bright Data request is needed to repeat a comparison.

## AI use disclosure

Bright Data Scraper Studio is used to generate and approve collector code, including the demonstrated self-healing repair. ApplySignal's normalization, Reciprocity Gap labels, lifecycle diffs, and bounded repost inferences are deterministic application code. The system does not use an LLM to invent employer facts, collect candidate values, or submit applications.

## Credit-aware collection policy

Collector creation and live runs are paid external actions. The project keeps one completed collector per target, prefers scoped detail pages or small boards when full-board generation is unreliable, applies a minimum-row guard, and does not rerun a target solely for confirmation. A run handed to Bright Data batch mode is treated as pending until output is returned; it is not retriggered automatically after a local poll is stopped.

The collector CLI also skips a successful run for the same collector/source within the default 24-hour cooldown before invoking Bright Data. Set `BRIGHTDATA_COOLDOWN_HOURS=0` for a deliberate no-cooldown run, or set `APPLYSIGNAL_FORCE_PAID_RUN=true` when an explicit rerun is justified.

Ingestion applies a structural and semantic health gate after envelope expansion: minimum cardinality, required-field coverage, duplicate identity detection, expected URL-host checks, obvious title/location swaps, and impossible exact date ordering. A suspicious result is persisted as `quarantined` with its health report and produces no job observations. `compareDistributionalHealth` reports baseline drift as review evidence; distribution changes do not trigger automatic healing by themselves.

The collector CLI passes `BRIGHTDATA_REQUIRED_FIELDS`, `BRIGHTDATA_IDENTITY_FIELD`, `BRIGHTDATA_EXPECTED_HOST`, and `BRIGHTDATA_MIN_COVERAGE` into that contract. Optional transport evidence can also quarantine navigation failures, non-success HTTP responses, unexpected final hosts, empty bodies, or explicit block/CAPTCHA indicators. When transport evidence is unavailable from a collector output, the report records `transportStatus: unknown`; it does not infer transport success from row presence alone.

When a baseline/current distribution comparison requires review, `buildHealDiagnosis` in `src/collectors/health.ts` generates a field-specific, review-gated prompt containing the affected coverage changes and record-count drift. It explicitly preserves the existing output schema and requires human approval after preview validation. It does not invoke `brightdata scraper heal`, approve a collector, or rerun a paid job.

Every catalog entry also declares its observation scope (`all_jobs`, `subset`, or `talent_pool`, plus geography and career filters). Health and cardinality claims are interpreted within that scope; a scoped zero is not treated as a failed full-board scrape.

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
