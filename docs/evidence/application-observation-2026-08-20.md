# Public application observation — Zerodha Fund House — 2026-08-20

- Collector: `c_mt0h6zkc2od06t5olc` (existing completed application-form collector)
- Public form evidence URL is persisted with the aggregate application observation; only public labels and metadata are retained.
- Target: one public backend-role application URL
- Collection strategy: one exact detail-page run; no board-wide rerun or retry
- Returned public field descriptors: 17
- Candidate values: not requested, submitted, or persisted
- Local observation: `obs_5f53acd41390db2a`
- Run ledger: `run_application_obs_20260820`, `runKind: application`

The run exposed field labels, input types, requiredness, and normalized categories. Local ingestion persisted the existing field list plus an aggregate application observation: 9 required fields, 8 optional fields, 1 attachment/resume field, 4 manual-history labels after deduplication, and an unknown account gate because the collector did not return account-gating metadata.

This is a burden observation for one public application flow, not a claim about all roles or a login-protected workflow. The 24-hour collector cooldown remains the default, and no follow-up Bright Data run is planned solely for confirmation.

The reproducible path is `bun run run:application` with the application-specific environment variables documented in the README. A subsequent invocation against this run returned `skipped: true` with reason `recent_success`, confirming that the cooldown prevented a duplicate paid request.
