# Review-gated healing diagnosis

ApplySignal separates detecting extraction drift from changing a Bright Data collector.

`compareDistributionalHealth` identifies material count or field-coverage changes. `buildHealDiagnosis` turns that evidence into a prompt suitable for a human-reviewed Bright Data healing step:

```text
Collector c_visa for source visa requires review before healing. Observed extraction drift: record count changed from 100 to 70; field location coverage changed from 98% to 12%. Restore the affected fields while you preserve the existing output schema and healthy title/identity extraction. Return a preview for validation; do not approve or rerun automatically. Human approval is required after semantic and cardinality checks.
```

The function returns `automaticHeal: false`. It does not call the Bright Data CLI, approve a preview, or spend credits. A stable comparison returns `status: no_action` and no prompt. This keeps the last-known-good observation boundary intact while making the next repair action concrete and auditable.

Review state can be persisted in the `heal_events` table and is exposed through `/api/summary` as `healEvents`. The dashboard renders `HEAL REVIEW` cards with awaiting-approval, approved, or rejected state and any repaired run ID. This record is deliberately separate from `scrape_runs`: a diagnosis or preview is not treated as a successful repaired collection until the human approval and rerun evidence exist.

The executable bridge is `bun run heal:collector`. With `APPLYSIGNAL_HEAL_ACTION=preview` (the default), it invokes `brightdata scraper heal` without `--auto-approve` or `--auto-save`, stores the returned preview as `approved: null`, and stops. A human can then explicitly set `APPLYSIGNAL_HEAL_ACTION=approve` and `APPLYSIGNAL_APPROVE_HEAL=true` to invoke `brightdata scraper approve`; the normal credit-aware collector command remains a separate, deliberate rerun step. The wrapper is therefore review-gated by construction and never silently turns a preview into a paid repair.
