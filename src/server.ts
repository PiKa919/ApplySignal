import { analyzeReciprocity } from "./domain/reciprocity";
import { diffObservations } from "./domain/lifecycle";
import { listApplicationFields, listLatestObservations } from "./storage/repository";
import type { Database } from "bun:sqlite";

const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export function createAppServer(db: Database) {
  const observations = () => listLatestObservations(db);
  const analysisFor = (observation: ReturnType<typeof observations>[number]) => analyzeReciprocity(observation, listApplicationFields(db, observation.observationId));

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/api/summary") {
        const jobs = observations();
        return json({
          sourceConfidence: jobs.map((job) => ({ observationId: job.observationId, sourceId: job.sourceId, confidence: job.sourceConfidence, dataMode: job.dataMode })),
          analyses: jobs.map((job) => ({ observationId: job.observationId, ...analysisFor(job) })),
        });
      }
      if (url.pathname === "/api/jobs") {
        return json(observations().map((job) => ({ ...job, analysis: analysisFor(job) })));
      }
      const detailMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (detailMatch) {
        const job = observations().find((candidate) => candidate.observationId === detailMatch[1]);
        if (!job) return json({ error: "job observation not found" }, 404);
        const history = observations().filter((candidate) => candidate.sourceId === job.sourceId && candidate.observationId !== job.observationId).slice(0, 5);
        return json({ ...job, fields: listApplicationFields(db, job.observationId), analysis: analysisFor(job), diffs: history.map((candidate) => diffObservations(candidate, job)) });
      }
      if (url.pathname === "/" || url.pathname === "/index.html") return new Response(await Bun.file(`${import.meta.dir}/ui/index.html`).text(), { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/styles.css") return new Response(await Bun.file(`${import.meta.dir}/ui/styles.css`).text(), { headers: { "content-type": "text/css; charset=utf-8" } });
      if (url.pathname === "/app.js") return new Response(await Bun.file(`${import.meta.dir}/ui/app.ts`).text(), { headers: { "content-type": "text/javascript; charset=utf-8" } });
      return new Response("Not found", { status: 404 });
    },
  };
}
