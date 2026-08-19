const metrics = document.querySelector("#metrics")!;
const jobs = document.querySelector("#jobs")!;
const detail = document.querySelector("#detail")!;
const count = document.querySelector("#count")!;
const health = document.querySelector("#health")!;

type Job = { observationId: string; title: string | null; location: string | null; dataMode: string; sourceConfidence: number | null; flags: { explicitEvergreen: boolean; evergreenLike: boolean; talentPool: boolean; multipleOpenings: boolean }; analysis: { gapLabel: string; explanation: string; requestedFieldCount: number; disclosedCount: number; resumeReentryFieldCount: number; resumeReentryLabel: string; lifecycleState: string; freshness: { precision: string; label: string; sourcePublishedAt: string | null; ageDays: number | null; ageMinDays: number | null; firstSeenAt: string } } };

const esc = (value: unknown) => String(value ?? "Unknown").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]!));
const safeHref = (value: unknown): string | null => {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? esc(parsed.toString()) : null;
  } catch {
    return null;
  }
};
const evidenceLink = (label: string, value: unknown): string => {
  const href = safeHref(value);
  return `<div><div class="detail-label">${esc(label)}</div><div class="detail-value">${href ? `<a href="${href}" target="_blank" rel="noreferrer">Open evidence</a>` : esc(value)}</div></div>`;
};

async function load() {
  const [summary, jobResponse] = await Promise.all([fetch("/api/summary").then((r) => r.json()), fetch("/api/jobs").then((r) => r.json())]);
  const jobsData = jobResponse as Job[];
  const runs = (summary.runs ?? []) as Array<{ sourceId: string; status: string; healthStatus: string; rowCount: number; observedAt: string }>;
  const validationResults = (summary.validationResults ?? []) as Array<{ sourceId: string; oracleId: string; status: string; agreementRate: number | null; matchedCount: number; oracleCount: number }>;
  const catalog = (summary.sourceCatalog ?? []) as Array<{ sourceId: string; name: string; status: string; note: string; scope: { geography: string | null; department: string | null; careerStage: string | null; employmentType: string | null; boardKind: string } }>;
  const activeSources = catalog.filter((source) => source.status === "live" || source.status === "live_scoped");
  const boardSources = catalog.filter((source) => source.status === "live");
  const scopedSources = catalog.filter((source) => source.status === "live_scoped");
  const cards = catalog.map((source) => `<div class="health-card ${esc(source.status)}"><div class="health-source">${esc(source.name)}</div><div class="health-meta">${esc(source.status)} · scope ${esc(source.scope.boardKind)} · ${esc(source.note)}</div></div>`);
  const runCards = runs.map((run) => `<div class="health-card ${esc(run.status)}"><div class="health-source">Run: ${esc(run.sourceId)}</div><div class="health-meta">${esc(run.status)} · healthStatus ${esc(run.healthStatus)} · ${esc(run.rowCount)} rows · ${esc(new Date(run.observedAt).toLocaleString())}</div></div>`);
  const validationCards = validationResults.map((result) => `<div class="health-card ${esc(result.status)}"><div class="health-source">Oracle: ${esc(result.sourceId)}</div><div class="health-meta">${esc(result.status)} · ${result.agreementRate === null ? "insufficient data" : `${result.matchedCount}/${result.oracleCount} IDs matched (${Math.round(result.agreementRate * 100)}%)`} · ${esc(result.oracleId)}</div></div>`);
  health.innerHTML = [...cards, ...runCards, ...validationCards].join("") || `<div class="muted">No collector runs recorded yet.</div>`;
  metrics.innerHTML = [
    ["OBSERVATIONS", jobsData.length],
    ["KNOWN SOURCE CONFIDENCE", `${Math.round((jobsData.reduce((sum, job) => sum + (job.sourceConfidence ?? 0), 0) / Math.max(jobsData.length, 1)) * 100)}%`],
    ["INFORMATION ASYMMETRY", jobsData.filter((job) => job.analysis.gapLabel === "information asymmetry").length],
    ["DATA MODE", jobsData.some((job) => job.dataMode === "live") ? "LIVE + FIXTURE" : "FIXTURE"],
    ["ACTIVE SOURCES", `${activeSources.length} (${boardSources.length} board · ${scopedSources.length} scoped)`],
    ["ORACLE VALIDATION", validationResults.length ? `${validationResults.filter((result) => result.status === "agree").length}/${validationResults.length} agree` : "NOT RUN"],
  ].map(([label, value]) => `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${esc(value)}</div></div>`).join("");
  count.textContent = `${jobsData.length} recorded observations`;
  jobs.innerHTML = jobsData.length ? jobsData.map((job) => `<article class="job-card" data-id="${esc(job.observationId)}"><div class="job-top"><div><div class="job-title">${esc(job.title)}</div><div class="job-meta">${esc(job.location)} · ${esc(job.dataMode)} · source confidence ${Math.round((job.sourceConfidence ?? 0) * 100)}%</div></div><div><div class="job-gap">${esc(job.analysis.gapLabel)}</div><div class="job-state">LIFECYCLE · ${esc(job.analysis.lifecycleState)}</div><div class="job-freshness">FRESHNESS · ${esc(job.analysis.freshness.precision)}</div></div></div></article>`).join("") : `<div class="detail empty"><p>No observations loaded yet. Ingest the checked-in fixture or run a live Bright Data collector.</p></div>`;
  jobs.querySelectorAll<HTMLElement>(".job-card").forEach((card) => card.addEventListener("click", () => showDetail(card.dataset.id!)));
}

async function showDetail(id: string) {
  const job = await fetch(`/api/jobs/${encodeURIComponent(id)}`).then((r) => r.json());
  detail.classList.remove("empty");
  const provenance = Object.entries(job.provenance ?? {}).map(([field, value]) => {
    const raw = typeof value === "object" && value !== null && "raw" in value ? (value as { raw: unknown }).raw : "unknown";
    return `<li>${esc(field)}: ${esc(raw)}</li>`;
  }).join("");
  detail.innerHTML = `<p class="eyebrow">OBSERVATION EVIDENCE</p><h2>${esc(job.title)}</h2><p>${esc(job.location)} · ${esc(job.dataMode)} data · source confidence ${Math.round((job.sourceConfidence ?? 0) * 100)}%</p><div class="detail-section"><div class="detail-grid">${evidenceLink("Source URL", job.sourceUrl)}${evidenceLink("Listing URL", job.url)}${evidenceLink("Application URL", job.applicationUrl)}<div><div class="detail-label">Observed at</div><div class="detail-value">${esc(job.observedAt)}</div></div></div></div><div class="detail-section"><div class="detail-label">FRESHNESS</div><p>${esc(job.analysis.freshness.label)}</p><p>First observed by ApplySignal: ${esc(job.analysis.freshness.firstSeenAt)}</p></div><div class="detail-section"><div class="detail-label">LIFECYCLE</div><p class="lifecycle-state">${esc(job.analysis.lifecycleState)}</p><p>Lifecycle classification is separate from the Reciprocity Gap and source confidence.</p></div><div class="detail-section"><div class="detail-label">Disclosed categories</div><div class="detail-grid"><div><div class="detail-label">Count</div><div class="detail-value">${job.analysis.disclosedCount}</div></div><div><div class="detail-label">Requested fields</div><div class="detail-value">${job.analysis.requestedFieldCount}</div></div></div><p><strong>${esc(job.analysis.gapLabel)}</strong><br>${esc(job.analysis.explanation)}</p></div><div class="detail-section"><div class="detail-label">RESUME RE-ENTRY TAX</div><p>${esc(job.analysis.resumeReentryLabel)} · ${job.analysis.resumeReentryFieldCount} overlapping fields requested in addition to a resume.</p></div><div class="detail-section"><div class="detail-label">TALENT POOL / EVERGREEN FLAGS</div><p>TALENT POOL: ${job.flags.talentPool ? "yes" : "no"} · EXPLICIT EVERGREEN: ${job.flags.explicitEvergreen ? "yes" : "no"} · EVERGREEN-LIKE: ${job.flags.evergreenLike ? "yes" : "no"} · MULTIPLE OPENINGS: ${job.flags.multipleOpenings ? "yes" : "no"}</p></div><div class="detail-section"><div class="detail-label">RAW OBSERVED FIELDS</div>${provenance ? `<ul>${provenance}</ul>` : `<p>No raw field labels stored.</p>`}</div><div class="detail-section"><div class="detail-label">Application burden fields</div>${job.fields?.length ? `<ul>${job.fields.map((field: { label: string; required: boolean | null }) => `<li>${esc(field.label)} ${field.required === true ? "(required)" : "(unknown)"}</li>`).join("")}</ul>` : `<p>Not observed.</p>`}</div><div class="detail-section"><div class="detail-label">Lifecycle changes</div>${job.diffs?.length ? `<ul>${job.diffs.flatMap((diff: { changes: { field: string; before: unknown; after: unknown }[] }) => diff.changes.map((change) => `<li>${esc(change.field)}: ${esc(change.before)} → ${esc(change.after)}</li>`)).join("")}</ul>` : `<p>No comparison observations.</p>`}</div><div class="detail-section"><div class="detail-label">Inferences</div>${job.inferences?.length ? `<ul>${job.inferences.map((inference: { type: string; confidence: number; signals: string[] }) => `<li><span class="badge inferred">${esc(inference.type)}</span> ${Math.round(inference.confidence * 100)}% confidence — ${esc(inference.signals.join("; "))}</li>`).join("")}</ul>` : `<p>No bounded relationship inference.</p>`}</div>`;
}

load().catch((error) => { detail.innerHTML = `<p>Dashboard error: ${esc(error)}</p>`; });
