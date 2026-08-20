# ApplySignal submission-readiness audit — 2026-08-20

This audit maps the original ApplySignal plan to current repository and Bright Data evidence. It deliberately distinguishes a verified implementation, a scoped live observation, a partial validation result, and an unresolved generation attempt.

## Plan gates

| Gate | Requirement | Current evidence | Status |
| --- | --- | --- | --- |
| 1 | Data contract, source scope, and health report | `src/domain/observations.ts`, `src/collectors/health.ts`, persisted `sources` table, and `src/domain/source-catalog.ts`; normalization and health tests | Complete |
| 2 | One hard real scraper from listing/detail to normalized output | Visa and Cadence public Workday detail collectors; one normalized live observation each | Complete as scoped detail; full-board coverage not claimed |
| 3 | Run, validate, quarantine, diagnose, heal, approve, rerun | Controlled fault-injection artifact plus authenticated Zerodha self-healing evidence in `live-run-2026-08-20.md` | Complete |
| 4 | Remaining hard sources | Zerodha board live; Visa/Cadence scoped; BrowserStack bounded attempts unresolved; Meesho generation failed | Partial, explicitly bounded |
| 5 | Oracle/validation sources | Postman 50/111 ID comparison persisted as `mismatch`; Razorpay 26-row live Greenhouse source; CRED unresolved | Partial, with measured mismatch |
| 6 | Append-only observation history and lifecycle events | `posting_events`, lifecycle fixtures, persisted event/API/UI tests | Complete |
| 7 | Application burden and Reciprocity Gap | Zerodha public application metadata, transparency score, resume re-entry tax, and separate signal dimensions | Complete |
| 8 | Conservative lineage/repost inference | `inferPostingRelationship`, `lineage_edges` with `repost-v1`, persisted inference evidence, and separate UI labeling | Complete |
| 9 | Explorer, Compare, Job Evidence, and Source Health screens | `src/server.ts`, `src/ui/`, API/UI regression tests | Complete |
| 10 | Controlled fault injection | `bun run demo:health`; `approvalRequired: true`, `brokenRunCommitted: false`, `brightDataCalls: 0` | Complete |

## Bright Data and credit boundary

- Authenticated CLI verification: `brightdata zones` returned configured zones; secrets are not stored in the repository.
- Authenticated Firefox Scrapers Library lookup: all eight planned domains returned `No results found` at lookup time.
- Normal collector runs now apply cooldown, source-readiness guard, and zero-credit public preflight before a paid call.
- BrowserStack scoped generation `c_mt18102x1tmz2acjx0` timed out at `preview_picker` after `180/180` polls.
- CRED scoped generation `c_mt189layinrjas5h2` timed out at `code_generator` after `180/180` polls.
- Neither unresolved collector was run or approved. Both half-built templates are left for optional manual UI cleanup because Bright Data exposes no programmatic deletion.
- Latest observed Bright Data budget: `$50.00` balance and `$0.00` pending charge.

## Submission framing

The defensible claim is:

> ApplySignal is a tested, evidence-focused multi-source vertical slice powered by Bright Data Scraper Studio, with live board and scoped-detail observations, independent oracle validation, application-burden analysis, lifecycle evidence, and an explicit quarantine/healing boundary. It records unresolved or failed-generation sources instead of presenting them as live coverage.

It is not defensible to claim that all eight proposed career sites produced healthy live collectors. The source catalog, dashboard, and evidence files preserve that limitation visibly.

## Verification

Latest local verification:

```text
126 tests passed, 0 failed
bun build src/index.ts --target bun --outdir /tmp/applysignal-root-build
bun build src/cli/run-collector.ts --target bun --outdir /tmp/applysignal-run-build
git diff --check
```

Runtime smoke verification on port 3310:

```text
GET /           -> 200 (4,964 bytes)
GET /app.js     -> 200 (15,368 bytes)
GET /api/summary -> 200 (9 catalog sources, 11 runs, 1 validation result, 404 snapshots)
GET /api/jobs    -> 200 (404 jobs)
```

The existing SQLite database now opens with 9 persisted source records, 401 posting records linked to 404 observations, and an empty lineage-edge table; no historical repost inference rows were present to migrate. The job-detail API and UI separately expose any persisted lineage edges alongside lifecycle events and bounded inferences.
