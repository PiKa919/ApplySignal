# Company Sorting and Research Queue Design

## Scope

ApplySignal gains two independent capabilities: a client-side company sort control and a persisted queue for user-submitted public job-detail URLs.

## Design

The observations control supports newest posted date (default), company name A–Z, and company name Z–A. Sorting changes the visible cards and comparison selectors without changing stored observations or collector behavior.

The research queue stores canonical HTTP(S) URLs with `pending`, `processing`, `completed`, and `failed` states. Submission only validates, canonicalizes, deduplicates, and persists the URL. A scheduled GitHub Action invokes a bounded worker that processes at most one due URL per run. The worker performs public preflight first; only a reachable URL can invoke the configured Bright Data research collector. Healthy collector output is normalized and ingested through the existing lifecycle/analysis pipeline as a live observation. Failed attempts persist an error and retry time for later runs.

## Evidence and safety

- Queue records retain the submitted URL, attempt count, status, error, observation ID, and preflight/collector evidence.
- No fixture rows are created by queue submission or processing.
- The worker has an explicit collector ID and processes one URL by default to limit credit consumption.
- Company name is taken from observed collector data when available; otherwise the submitted source hostname is shown rather than invented as an employer fact.

## Verification

Tests cover URL canonicalization/deduplication, queue state transitions, blocked-preflight zero-call behavior, successful ingestion, API submission/listing, UI controls, browser bundling, and the full existing suite.
