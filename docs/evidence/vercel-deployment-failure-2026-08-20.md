# Vercel deployment failure — 2026-08-20

## Public runtime check

The deployment at `https://applysignal-seven.vercel.app/` was checked from a clean browser session and with direct HTTP requests.

| Route | Result |
| --- | --- |
| `/` | `500 FUNCTION_INVOCATION_FAILED` |
| `/api/summary` | `500 FUNCTION_INVOCATION_FAILED` |
| `/app.js` | `500 FUNCTION_INVOCATION_FAILED` |
| `/styles.css` | `500 FUNCTION_INVOCATION_FAILED` |

The browser renders Vercel's error page stating that the Serverless Function crashed. No ApplySignal UI or API response is reachable from this deployment.

## Diagnosis

ApplySignal is a Bun HTTP server using `Bun.serve` and Bun's SQLite implementation. The repository does not contain a Vercel serverless adapter or a Vercel function entrypoint. Vercel's current deployment therefore invokes the application in an incompatible serverless shape instead of running the long-lived Bun server.

This is a deployment/runtime mismatch, not evidence that the UI itself is broken. The local seeded runtime and GitHub CI Docker build remain passing.

## Correct hosting path

The repository's [`Dockerfile`](../../Dockerfile) and [`render.yaml`](../../render.yaml) define the supported hosted deployment: a Render Docker web service with fixture seeding and `/api/summary` as the health check. The Vercel URL must not be used as the final demo URL until a compatible adapter and persistence strategy are deliberately implemented.

