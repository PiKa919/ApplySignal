# ApplySignal handoff audit — 2026-08-20

This is a local, read-only audit of the repository state. It does not trigger Bright Data collection.

## Verified state

- Repository branch: `master`
- Source catalog entries: 9
- Persisted observations: 354
- Recorded collector runs: 8
- Live observations exist for: Zerodha Fund House, Palantir Lever fallback, Razorpay Greenhouse, Visa Workday detail, and Cadence Workday detail.
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
| BrowserStack | `unresolved` | No live rows; board and scoped attempts did not complete |
| Meesho | `failed_generation` | No live rows; two generation attempts failed |
| CRED | `unresolved` | No live rows; branded and direct-board attempts did not complete |
| Postman | `unresolved` | No live rows; latest batch handoff was stopped before output |

## Product and safety checks

- Reciprocity Gap remains separate from freshness, lifecycle, and source confidence.
- Possible repost relationships remain inferences and never merge observations.
- Missing salary, deadlines, and application fields remain unknown rather than negative claims.
- Application collectors inspect public field labels only; they do not submit forms or collect candidate values.
- AI use is disclosed in the dashboard and README.
- Independent oracle validation is implemented as a deterministic, persisted comparison layer; no oracle result is claimed until cached scraper and oracle IDs are supplied.
- Credit-aware policy: no automatic reruns, no confirmation reruns, and no new paid collection without a clear incremental evidence goal.

## Verification commands

```bash
bun test
bun build src/index.ts --target bun --outdir /tmp/applysignal-root-build
```

Latest local verification: 28 tests passed and the Bun build completed successfully.

## Remaining plan gap

The original eight-source ambition is not fully achieved. Four named targets remain without board-level live data, and two of the five active sources are scoped detail observations. The honest submission framing is a tested multi-source vertical slice with explicit Bright Data failure evidence, not an assertion that every proposed target was scrapeable.
