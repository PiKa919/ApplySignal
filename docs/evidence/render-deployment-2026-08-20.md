# Render deployment verification — 2026-08-20

## Deployment

- Blueprint: `applysignal`
- Repository: `PiKa919/ApplySignal`
- Branch: `main`
- Deployed commit: `aded226` (`docs: record Vercel deployment failure`)
- Public URL: https://applysignal.onrender.com/
- Health endpoint: https://applysignal.onrender.com/api/summary

The Render Blueprint used the repository's root [`render.yaml`](../../render.yaml) and Dockerfile. The hosted container seeds the controlled fixture into its ephemeral `/tmp` SQLite path when no database exists; it does not publish the local live database or any candidate data.

## Runtime verification

Direct HTTP checks returned:

| Route | Result |
| --- | --- |
| `/` | `200`, ApplySignal HTML |
| `/app.js` | `200`, hosted browser bundle |
| `/api/summary` | `200`, 9 catalog sources, 3 runs, 10 analyses |
| `/api/jobs` | `200`, 10 recorded jobs |

A clean browser session loaded the `ApplySignal` page, rendered the Compare panel and Source Health cards, and opened Job Evidence for the controlled `Senior Platform Engineer` observation. That detail view showed freshness, transparency, application burden, Resume Re-entry Tax, raw observed fields, and public-form metadata. No browser console errors or warnings were recorded during the smoke test.

## Hosting limitation

Render's free service can spin down after inactivity, so the first request may be delayed. The fixture-seeded public demo is deterministic; live Bright Data collection is not run by the hosted web process.

