# Render deployment verification — 2026-08-20

## Deployment

- Blueprint: `applysignal`
- Repository: `PiKa919/ApplySignal`
- Branch: `main`
- Repository commit prepared for deployment: `28ca8eb` (`fix: include live database in Docker context`)
- Public URL: https://applysignal.onrender.com/
- Health endpoint: https://applysignal.onrender.com/api/summary

The Render Blueprint uses the repository's root [`render.yaml`](../../render.yaml) and Dockerfile. The hosted container copies the checked-in live SQLite snapshot into `/app/data/applysignal.db` and runs with `APPLYSIGNAL_LIVE_ONLY=true`; it does not seed controlled fixtures or publish candidate data.

## Runtime verification

The repository now contains a checked-in live snapshot and the Docker image is configured to deploy it with live-only filtering. The latest GitHub Actions run passed tests, Bun builds, the Docker build, and the fixture audit. The public service still needs to complete its rollout from the prior image; until then, its API remains an old deployment and must not be treated as current evidence.

The Render service is configured for commit-triggered deployment so the validated GitHub commit is not held behind Render's CI-check detection.

Current direct HTTP check:

| Route | Result |
| --- | --- |
| `/` | `200`, ApplySignal HTML |
| `/app.js` | `200`, hosted browser bundle |
| `/api/summary` | `200`, old deployment still serving prior fixture-backed state |
| `/api/jobs` | `200`, old deployment still serving 10 fixture observations |

A clean browser session previously loaded the ApplySignal page and rendered the Compare and Source Health panels. A fresh browser verification is required after the new Render image is live.

## Hosting limitation

Render's free service can spin down after inactivity, so the first request may be delayed. The hosted web process serves the checked-in live snapshot; Bright Data collection is intentionally not run by the hosted web process.
