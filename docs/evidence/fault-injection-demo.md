# Credit-free fault-injection demo

Run:

```sh
bun run demo:health
```

The command uses the local controlled career-site fixture. It simulates extraction drift by dropping two rows and removing one location value from the current run. No Bright Data request is made and no database row is written.

The generated `artifacts/applysignal-health-demo.json` contains:

- a healthy baseline report;
- a quarantined current report with cardinality and location-coverage failures;
- distributional drift and a field-specific healing diagnosis;
- `lastKnownGoodRetained: true`;
- `brokenRunCommitted: false`;
- `approvalRequired: true`;
- `brightDataCalls: 0`.

This is the deterministic reproduction for the scraper's credit-saving boundary: a failed or suspicious run is retained for diagnosis, while the last known good data remains the product-facing result until a human reviews and approves a separately validated repair.
