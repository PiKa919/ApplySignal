import { buildObservationAnalysis } from "./domain/analysis";
import { diffObservations, inferPostingRelationship } from "./domain/lifecycle";
import { listAnalysisSnapshots, listApplicationFields, listApplicationObservation, listHealEvents, listLatestObservations, listLineageEdges, listPostings, listPostingEvents, listScrapeRuns, listSources, listValidationResults } from "./storage/repository";
import type { Database } from "bun:sqlite";

const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export function createAppServer(db: Database) {
  const createContext = () => {
    const jobs = listLatestObservations(db);
    const snapshots = listAnalysisSnapshots(db);
    const snapshotByObservation = new Map(snapshots.map((snapshot) => [snapshot.observationId, snapshot.analysis]));
    const fieldsByObservation = new Map(jobs.map((job) => [job.observationId, listApplicationFields(db, job.observationId)]));
    const jobsBySource = new Map<string, typeof jobs>();
    for (const job of jobs) jobsBySource.set(job.sourceId, [...(jobsBySource.get(job.sourceId) ?? []), job]);
    const historyFor = (observation: typeof jobs[number]) => (jobsBySource.get(observation.sourceId) ?? [])
      .filter((candidate) => candidate.observationId !== observation.observationId && candidate.observedAt < observation.observedAt);
    const analysisFor = (observation: typeof jobs[number]) => {
      const previous = historyFor(observation)[0] ?? null;
      return snapshotByObservation.get(observation.observationId) ?? buildObservationAnalysis(observation, previous, fieldsByObservation.get(observation.observationId) ?? []);
    };
    return { jobs, jobsBySource, historyFor, analysisFor, snapshots };
  };

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/api/summary") {
        const context = createContext();
        const { jobs, snapshots } = context;
        const runs = listScrapeRuns(db);
        const lastKnownGood = [...new Map(runs
          .filter((run) => run.status === "success" && run.healthStatus === "healthy")
          .map((run) => [`${run.sourceId}:${run.runKind}`, run])).values()];
        return json({
          sourceCatalog: listSources(db),
          postings: listPostings(db),
          runs,
          lastKnownGood,
          healEvents: listHealEvents(db),
          validationResults: listValidationResults(db),
          postingEvents: listPostingEvents(db),
          lineageEdges: listLineageEdges(db),
          analysisSnapshots: snapshots,
          sourceConfidence: jobs.map((job) => ({ observationId: job.observationId, sourceId: job.sourceId, confidence: job.sourceConfidence, dataMode: job.dataMode })),
          analyses: jobs.map((job) => ({ observationId: job.observationId, ...context.analysisFor(job) })),
        });
      }
      if (url.pathname === "/api/jobs") {
        const context = createContext();
        return json(context.jobs.map((job) => ({ ...job, analysis: context.analysisFor(job) })));
      }
      if (url.pathname === "/api/compare") {
        const leftId = url.searchParams.get("left");
        const rightId = url.searchParams.get("right");
        if (!leftId || !rightId) return json({ error: "left and right observation IDs are required" }, 400);
        const context = createContext();
        const { jobs } = context;
        const left = jobs.find((job) => job.observationId === leftId);
        const right = jobs.find((job) => job.observationId === rightId);
        if (!left || !right) return json({ error: "one or both observations were not found" }, 404);
        return json({
          dimensions: ["freshness", "transparency", "application_burden", "lifecycle", "source_confidence"],
          left: { ...left, analysis: context.analysisFor(left) },
          right: { ...right, analysis: context.analysisFor(right) },
        });
      }
      const detailMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (detailMatch) {
        const context = createContext();
        const job = context.jobs.find((candidate) => candidate.observationId === detailMatch[1]);
        if (!job) return json({ error: "job observation not found" }, 404);
        const history = (context.jobsBySource.get(job.sourceId) ?? []).filter((candidate) => candidate.observationId !== job.observationId).slice(0, 5);
        const inferences = history.map((candidate) => inferPostingRelationship(candidate, job)).filter((inference) => inference !== null);
        const events = listPostingEvents(db).filter((event) => event.sourceId === job.sourceId && (event.postingId === job.postingId || event.afterObservationId === job.observationId || event.beforeObservationId === job.observationId));
        const lineageEdges = listLineageEdges(db).filter((edge) => edge.fromPostingId === job.postingId || edge.toPostingId === job.postingId || edge.fromObservationId === job.observationId || edge.toObservationId === job.observationId);
        return json({ ...job, fields: listApplicationFields(db, job.observationId), applicationObservation: listApplicationObservation(db, job.observationId), analysis: context.analysisFor(job), diffs: history.map((candidate) => diffObservations(candidate, job)), inferences, lineageEdges, events });
      }
      if (url.pathname === "/" || url.pathname === "/index.html") return new Response(await Bun.file(`${import.meta.dir}/ui/index.html`).text(), { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/styles.css") return new Response(await Bun.file(`${import.meta.dir}/ui/styles.css`).text(), { headers: { "content-type": "text/css; charset=utf-8" } });
      if (url.pathname === "/app.js") {
        const source = await Bun.file(`${import.meta.dir}/ui/app.ts`).text();
        const javascript = new Bun.Transpiler({ loader: "tsx" }).transformSync(source);
        return new Response(javascript, { headers: { "content-type": "text/javascript; charset=utf-8" } });
      }
      return new Response("Not found", { status: 404 });
    },
  };
}
