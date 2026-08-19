# ApplySignal

ApplySignal is candidate-side career intelligence for the Scrape-Verse hackathon. It compares what an employer discloses in a public listing with what the public application flow asks from a candidate.

The product keeps these signals separate:

- freshness
- transparency
- application burden
- lifecycle changes
- source confidence

Its central view is the Reciprocity Gap: an explainable comparison between disclosed categories and requested application fields. A possible repost is an inference between two observations; it is never treated as proof that two postings represent one vacancy.

## Run locally

Requires Bun.

```bash
bun test
bun run seed:fixture
bun run dev
```

Open <http://localhost:3000>.

The fixture command writes `data/applysignal.db`, which is ignored by Git. It seeds the public-source snapshot plus a separate, clearly labeled `demo-lifecycle` source with two observations so the dashboard can demonstrate factual diffs and a possible-repost inference. Fixture observations are visibly labeled in the dashboard.

## Bright Data workflow

The live collector boundary is `src/collectors/brightdata.ts`. Credentials are supplied through the Bright Data CLI, never committed to this repository.

```bash
brightdata login
brightdata zones
BRIGHTDATA_COLLECTOR_ID=<collector-id> \
BRIGHTDATA_SOURCE_ID=zfh \
BRIGHTDATA_SOURCE_URL=https://careers.zerodhafundhouse.com/jobs \
BRIGHTDATA_TARGET_URL=https://careers.zerodhafundhouse.com/jobs \
bun run run:collector
```

The first live collector was created in Scraper Studio for Zerodha Fund House. The live run returned 13 listing observations. A second Scraper Studio collector inspected the public Senior Backend Engineer application form and returned 17 visible fields without submitting the form or collecting candidate values. The Palantir Lever fallback collector completed through a Bright Data batch handoff and returned 307 public listing observations. Razorpay returned 26 rows from its direct Greenhouse board, and Visa now has one explicitly scoped live Workday detail observation. `run:collector` applies the minimum-row cardinality guard and persists the run before the dashboard reads it.

The approved self-healing run added `closing_date_text`, returned `null` when no public deadline was visible, and preserved the existing listing fields. Evidence is documented in `docs/evidence/`.

## AI use disclosure

Bright Data Scraper Studio is used to generate and approve collector code, including the demonstrated self-healing repair. ApplySignal's normalization, Reciprocity Gap labels, lifecycle diffs, and bounded repost inferences are deterministic application code. The system does not use an LLM to invent employer facts, collect candidate values, or submit applications.

## Evidence boundary

Live and fixture data are separate. Missing salary, deadlines, or application fields remain unknown; they are not converted to negative claims. The app does not submit applications or access login-protected data.

## Project map

- `src/domain/`: observation normalization, Reciprocity Gap analysis, lifecycle diffs, and bounded inferences
- `src/collectors/`: Bright Data adapter, cardinality guard, fixture ingestion, and application-field ingestion
- `src/storage/`: SQLite schema and repositories
- `src/server.ts`: JSON API and static dashboard server
- `src/ui/`: evidence-focused dashboard
- `docs/superpowers/`: approved design and implementation plan
- `docs/evidence/`: Bright Data preflight and live-run records
