# ApplySignal demo runbook

This is the reproducible, credit-aware path for recording or reviewing the hackathon demo. It uses the existing SQLite snapshot and the checked-in controlled fixture; it does not require a new Bright Data collection call.

## 1. Verify the local surface

```sh
bun test
bun run audit
bun run demo:health
PORT=3310 bun run src/index.ts
```

Open `http://localhost:3310` and show these surfaces in order:

1. **Source Health:** live, scoped, partial, unresolved, and failed-generation states are visible separately; collector IDs and source families are shown as configuration evidence.
2. **Explorer:** select the live Zerodha Fund House backend role.
3. **Job Evidence:** show freshness, transparency, Reciprocity Gap, application burden, Resume Re-entry Tax, talent-pool/evergreen flags, and public evidence links.
4. **Compare:** select two observations and show the five independent dimensions without a universal “worth applying” score.
5. **Fault injection:** show `artifacts/applysignal-health-demo.json`; the current run is quarantined, the last-known-good result is retained, approval is required, and `brightDataCalls` is `0`.

## 2. Demo narration

> Job boards tell you what is open. ApplySignal tells you what you are signing up for.

Show the Zerodha role's public disclosure beside its public application metadata. Explain that the Reciprocity Gap compares disclosed categories with visible requested fields, and that missing information remains unknown rather than becoming a negative employer claim.

Then show the lifecycle and lineage sections. Observation facts, lifecycle events, and possible-repost relationships are stored separately; a possible repost is evidence-backed inference, not a merged vacancy or a “ghost job” verdict.

Finish on Source Health and the fault-injection artifact. Emphasize that suspicious output cannot create business events until it passes cardinality, field-coverage, semantic, and distributional checks, and that healing remains review-gated.

## 3. Bright Data evidence boundary

The live Bright Data evidence is already recorded in [`live-run-2026-08-20.md`](live-run-2026-08-20.md) and [`brightdata-preflight.md`](brightdata-preflight.md). The current repository snapshot contains live Zerodha Fund House, Palantir fallback, Razorpay, Visa scoped-detail, Cadence scoped-detail, and partial Postman evidence. BrowserStack and CRED remain unresolved; Meesho remains failed-generation. Do not describe those targets as healthy live collectors.

The collector CLI defaults to cooldown, persisted source-readiness checks, and zero-credit ordinary HTTP preflight. A new paid run requires a deliberate operator decision and should have a specific incremental evidence goal.

The bounded public application collector uses the same preflight boundary; it never submits a form and stops before Bright Data when the target is blocked or unreachable.

## 4. External submission checklist

These items reflect the current external handoff state:

- [x] Public repository URL configured and verified: https://github.com/PiKa919/ApplySignal.
- [ ] Hosted demo verified after the live-snapshot rollout on Render: https://applysignal.onrender.com/. Deployment status is in [`render-deployment-2026-08-20.md`](render-deployment-2026-08-20.md).
- [x] Demo video URL recorded and verified in the public repository: [`artifacts/applysignal-demo-2026-08-20.mp4`](https://github.com/PiKa919/ApplySignal/raw/main/artifacts/applysignal-demo-2026-08-20.mp4). It is a fixture-only UI walkthrough; the final submission should add the Bright Data terminal workflow if a narrated recording is required.
- [ ] Final submission form completed with the bounded source-coverage language from [`submission-readiness.md`](submission-readiness.md). As checked on 2026-08-20, the form is open through August 23, 2026 and asks for the repository, demo video, project description, and how Scraper Studio was used: [official submission form](https://forms.gle/iQf2SjHQViSJaRAv7).
- [x] AI assistance disclosure retained in the public README and demo.
