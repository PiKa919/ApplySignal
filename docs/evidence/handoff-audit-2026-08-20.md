# ApplySignal handoff audit — 2026-08-20

This is a local, read-only audit of the repository state. It does not trigger Bright Data collection.

## Verified state

- Repository branch: `master`
- Source catalog entries: 9
- Persisted observations: 404
- Recorded collector runs: 11
- Live observations exist for: Zerodha Fund House, Palantir Lever fallback, Razorpay Greenhouse, Visa Workday detail, Cadence Workday detail, and the partial Postman Greenhouse extraction.
- Scoped sources: Visa and Cadence. Their detail pages are live observations; neither is claimed as full-board coverage.
- Fixture data remains separate and visibly labeled, including the lifecycle demo.
- Bright Data credentials remain outside the repository and are supplied by the authenticated CLI.

## Source-status boundary

| Source | Status | What can be claimed |
| --- | --- | --- |
| Zerodha Fund House | `live` | Board-level listing run plus public application-field observation |
| Palantir Lever | `live` | Board-level 307-row custom Scraper Studio run, including batch handoff |
| Razorpay | `live` | Board-level 26-row run from the linked public Greenhouse board |
| Visa | `live_scoped` | One normalized public Workday detail observation; full board unresolved |
| Cadence | `live_scoped` | One normalized public Workday detail observation; duplicate raw labels retained |
| BrowserStack | `unresolved` | No live rows; board, scoped, and bounded CLI attempts did not complete |
| Meesho | `failed_generation` | No live rows; two generation attempts failed |
| CRED | `unresolved` | No live rows; branded, direct-board, and bounded scoped CLI attempts did not complete |
| Postman | `partial` | 50 normalized Greenhouse job IDs matched against a public 111-ID oracle; 61 IDs remain missing |

## Product and safety checks

- Reciprocity Gap remains separate from freshness, lifecycle, and source confidence.
- Possible repost relationships remain inferences and never merge observations; persisted lineage edges are exposed separately from lifecycle events.
- Missing salary, deadlines, and application fields remain unknown rather than negative claims.
- Application collectors inspect public field labels only; they do not submit forms or collect candidate values.
- AI use is disclosed in the dashboard and README.
- Independent oracle validation is implemented as a deterministic, persisted comparison layer; no oracle result is claimed until cached scraper and oracle IDs are supplied.
- Postman’s persisted oracle result is explicitly `mismatch` (50/111 IDs); it is not counted as an active source.
- Credit-aware policy: no automatic reruns, no confirmation reruns, and no new paid collection without a clear incremental evidence goal.
- The collector CLI now performs a zero-credit public preflight and refuses `unresolved`/`failed_generation` catalog sources unless an operator explicitly overrides the source guard.

## Verification commands

```bash
bun test
bun build src/index.ts --target bun --outdir /tmp/applysignal-root-build
```

Latest local verification: 128 tests passed and the Bun builds completed successfully. The runtime smoke served `/`, `/app.js`, `/api/summary`, `/api/jobs`, `/api/jobs/:observationId`, and `/api/compare` successfully against the existing SQLite database. The controlled fault-injection demo reports `approvalRequired: true`, `brokenRunCommitted: false`, and `brightDataCalls: 0`.

## Remaining plan gap

The original eight-source ambition is not fully achieved. BrowserStack, Meesho, and CRED remain unresolved/failed after bounded generation attempts, Visa and Cadence are scoped detail observations, and Postman is partial with a measured oracle mismatch. The honest submission framing is a tested multi-source vertical slice with explicit Bright Data failure and validation evidence, not an assertion that every proposed target was scrapeable.
