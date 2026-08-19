const metrics = document.querySelector("#metrics")!;
const jobs = document.querySelector("#jobs")!;
const detail = document.querySelector("#detail")!;
const count = document.querySelector("#count")!;
const health = document.querySelector("#health")!;

type Job = { observationId: string; title: string | null; location: string | null; dataMode: string; sourceConfidence: number | null; analysis: { gapLabel: string; explanation: string; requestedFieldCount: number; disclosedCount: number } };

const esc = (value: unknown) => String(value ?? "Unknown").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]!));

async function load() {
  const [summary, jobResponse] = await Promise.all([fetch("/api/summary").then((r) => r.json()), fetch("/api/jobs").then((r) => r.json())]);
  const jobsData = jobResponse as Job[];
  const runs = (summary.runs ?? []) as Array<{ sourceId: string; status: string; rowCount: number; observedAt: string }>;
  const catalog = (summary.sourceCatalog ?? []) as Array<{ sourceId: string; name: string; status: string; note: string }>;
  const cards = catalog.map((source) => `<div class="health-card ${esc(source.status)}"><div class="health-source">${esc(source.name)}</div><div class="health-meta">${esc(source.status)} · ${esc(source.note)}</div></div>`);
  const runCards = runs.map((run) => `<div class="health-card ${esc(run.status)}"><div class="health-source">Run: ${esc(run.sourceId)}</div><div class="health-meta">${esc(run.status)} · ${esc(run.rowCount)} rows · ${esc(new Date(run.observedAt).toLocaleString())}</div></div>`);
  health.innerHTML = [...cards, ...runCards].join("") || `<div class="muted">No collector runs recorded yet.</div>`;
  metrics.innerHTML = [
    ["OBSERVATIONS", jobsData.length],
    ["KNOWN SOURCE CONFIDENCE", `${Math.round((jobsData.reduce((sum, job) => sum + (job.sourceConfidence ?? 0), 0) / Math.max(jobsData.length, 1)) * 100)}%`],
    ["INFORMATION ASYMMETRY", jobsData.filter((job) => job.analysis.gapLabel === "information asymmetry").length],
    ["DATA MODE", jobsData.some((job) => job.dataMode === "live") ? "LIVE + FIXTURE" : "FIXTURE"],
  ].map(([label, value]) => `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${esc(value)}</div></div>`).join("");
  count.textContent = `${jobsData.length} recorded observations`;
  jobs.innerHTML = jobsData.length ? jobsData.map((job) => `<article class="job-card" data-id="${esc(job.observationId)}"><div class="job-top"><div><div class="job-title">${esc(job.title)}</div><div class="job-meta">${esc(job.location)} · ${esc(job.dataMode)} · source confidence ${Math.round((job.sourceConfidence ?? 0) * 100)}%</div></div><div class="job-gap">${esc(job.analysis.gapLabel)}</div></div></article>`).join("") : `<div class="detail empty"><p>No observations loaded yet. Ingest the checked-in fixture or run a live Bright Data collector.</p></div>`;
  jobs.querySelectorAll<HTMLElement>(".job-card").forEach((card) => card.addEventListener("click", () => showDetail(card.dataset.id!)));
}

async function showDetail(id: string) {
  const job = await fetch(`/api/jobs/${encodeURIComponent(id)}`).then((r) => r.json());
  detail.classList.remove("empty");
  detail.innerHTML = `<p class="eyebrow">OBSERVATION EVIDENCE</p><h2>${esc(job.title)}</h2><p>${esc(job.location)} · ${esc(job.dataMode)} data · source confidence ${Math.round((job.sourceConfidence ?? 0) * 100)}%</p><div class="detail-section"><div class="detail-grid"><div><div class="detail-label">Disclosed categories</div><div class="detail-value">${job.analysis.disclosedCount}</div></div><div><div class="detail-label">Requested fields</div><div class="detail-value">${job.analysis.requestedFieldCount}</div></div></div><p><strong>${esc(job.analysis.gapLabel)}</strong><br>${esc(job.analysis.explanation)}</p></div><div class="detail-section"><div class="detail-label">Application burden fields</div>${job.fields?.length ? `<ul>${job.fields.map((field: { label: string; required: boolean | null }) => `<li>${esc(field.label)} ${field.required === true ? "(required)" : "(unknown)"}</li>`).join("")}</ul>` : `<p>Not observed.</p>`}</div><div class="detail-section"><div class="detail-label">Lifecycle changes</div>${job.diffs?.length ? `<ul>${job.diffs.flatMap((diff: { changes: { field: string; before: unknown; after: unknown }[] }) => diff.changes.map((change) => `<li>${esc(change.field)}: ${esc(change.before)} → ${esc(change.after)}</li>`)).join("")}</ul>` : `<p>No comparison observations.</p>`}</div>`;
}

load().catch((error) => { detail.innerHTML = `<p>Dashboard error: ${esc(error)}</p>`; });
