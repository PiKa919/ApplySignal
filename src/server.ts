import { analyzeReciprocity } from "./domain/reciprocity";
import { classifyLifecycleState, diffObservations, inferPostingRelationship } from "./domain/lifecycle";
import { analyzeFreshness } from "./domain/freshness";
import { SOURCE_CATALOG } from "./domain/source-catalog";
import { listApplicationFields, listLatestObservations, listPostingEvents, listScrapeRuns, listValidationResults } from "./storage/repository";
import type { Database } from "bun:sqlite";

const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export function createAppServer(db: Database) {
  const observations = () => listLatestObservations(db);
  const historyFor = (observation: ReturnType<typeof observations>[number]) => observations()
    .filter((candidate) => candidate.sourceId === observation.sourceId && candidate.observationId !== observation.observationId)
    .filter((candidate) => candidate.observedAt < observation.observedAt);
  const analysisFor = (observation: ReturnType<typeof observations>[number]) => {
    const previous = historyFor(observation)[0] ?? null;
    return {
      ...analyzeReciprocity(observation, listApplicationFields(db, observation.observationId)),
      lifecycleState: classifyLifecycleState({ current: observation, previous }),
      freshness: analyzeFreshness(observation),
    };
  };

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/api/summary") {
        const jobs = observations();
        return json({
          sourceCatalog: SOURCE_CATALOG,
          runs: listScrapeRuns(db),
          validationResults: listValidationResults(db),
          postingEvents: listPostingEvents(db),
          sourceConfidence: jobs.map((job) => ({ observationId: job.observationId, sourceId: job.sourceId, confidence: job.sourceConfidence, dataMode: job.dataMode })),
          analyses: jobs.map((job) => ({ observationId: job.observationId, ...analysisFor(job) })),
        });
      }
      if (url.pathname === "/api/jobs") {
        return json(observations().map((job) => ({ ...job, analysis: analysisFor(job) })));
      }
      if (url.pathname === "/api/compare") {
        const leftId = url.searchParams.get("left");
        const rightId = url.searchParams.get("right");
        if (!leftId || !rightId) return json({ error: "left and right observation IDs are required" }, 400);
        const jobs = observations();
        const left = jobs.find((job) => job.observationId === leftId);
        const right = jobs.find((job) => job.observationId === rightId);
        if (!left || !right) return json({ error: "one or both observations were not found" }, 404);
        return json({
          dimensions: ["freshness", "transparency", "application_burden", "lifecycle", "source_confidence"],
          left: { ...left, analysis: analysisFor(left) },
          right: { ...right, analysis: analysisFor(right) },
        });
      }
      const detailMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (detailMatch) {
        const job = observations().find((candidate) => candidate.observationId === detailMatch[1]);
        if (!job) return json({ error: "job observation not found" }, 404);
        const history = observations().filter((candidate) => candidate.sourceId === job.sourceId && candidate.observationId !== job.observationId).slice(0, 5);
        const inferences = history.map((candidate) => inferPostingRelationship(candidate, job)).filter((inference) => inference !== null);
        const events = listPostingEvents(db).filter((event) => event.sourceId === job.sourceId && (event.afterObservationId === job.observationId || event.beforeObservationId === job.observationId));
        return json({ ...job, fields: listApplicationFields(db, job.observationId), analysis: analysisFor(job), diffs: history.map((candidate) => diffObservations(candidate, job)), inferences, events });
      }
      if (url.pathname === "/" || url.pathname === "/index.html") return new Response(await Bun.file(`${import.meta.dir}/ui/index.html`).text(), { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/styles.css") return new Response(await Bun.file(`${import.meta.dir}/ui/styles.css`).text(), { headers: { "content-type": "text/css; charset=utf-8" } });
      if (url.pathname === "/app.js") return new Response(await Bun.file(`${import.meta.dir}/ui/app.ts`).text(), { headers: { "content-type": "text/javascript; charset=utf-8" } });
      return new Response("Not found", { status: 404 });
    },
  };
}
