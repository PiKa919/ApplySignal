# Live production snapshot — 2026-08-20

The hosted production database is a SQLite snapshot at `data/applysignal.db`, refreshed only from successful, validated Bright Data collector output.

Current snapshot evidence:

- 345 observations total
- `dataMode=live` for every production observation
- 13 Zerodha Fund House rows
- 308 Palantir Lever rows
- 24 Razorpay Greenhouse rows
- every production observation has a public listing URL
- zero production URLs point to `fixture.applysignal.test` or `example.test`

The checked-in fixture files remain available for local tests and the controlled health-demo workflow. The Docker image does not run `seed:fixture`; it copies this SQLite snapshot and starts the server in `APPLYSIGNAL_LIVE_ONLY=true` mode.

The Bright Data workflow remains manual and confirmation-gated. It performs zero-credit public preflight first, runs only the selected collector, audits the resulting database, and commits the refreshed SQLite snapshot only when the operator explicitly confirms the paid run.
