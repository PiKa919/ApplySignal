const metrics = document.querySelector("#metrics")!;
const jobs = document.querySelector("#jobs")!;
const detail = document.querySelector("#detail")!;
const count = document.querySelector("#count")!;
const health = document.querySelector("#health")!;
const compareLeft = document.querySelector<HTMLSelectElement>("#compare-left")!;
const compareRight = document.querySelector<HTMLSelectElement>("#compare-right")!;
const compareRun = document.querySelector<HTMLButtonElement>("#compare-run")!;
const compareResult = document.querySelector<HTMLElement>("#compare-result")!;

type ApplicationObservation = { accountGate: boolean | null; resumeRequired: boolean | null; requiredFieldCount: number; optionalFieldCount: number; unknownFieldCount: number; customQuestionCount: number; longAnswerCount: number; attachmentCount: number; manualHistoryFields: string[] };
type HealthReport = { errors?: string[]; duplicateIdentityCount?: number; duplicateUrlCount?: number; paginationErrors?: string[]; distributions?: Record<string, Record<string, number>> };
type Job = { observationId: string; title: string | null; location: string | null; dataMode: string; sourceConfidence: number | null; flags: { explicitEvergreen: boolean; evergreenLike: boolean; talentPool: boolean; multipleOpenings: boolean }; applicationObservation?: ApplicationObservation | null; analysis: { gapLabel: string; explanation: string; requestedFieldCount: number; disclosedCount: number; resumeReentryFieldCount: number; resumeReentryLabel: string; transparencyScore: number; transparencySignals: { key: string; label: string; points: number; observed: boolean; evidence: string | null }[]; transparencyInterpretation: string; lifecycleState: string; freshness: { precision: string; label: string; sourcePublishedAt: string | null; ageDays: number | null; ageMinDays: number | null; firstSeenAt: string } } };

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

async function renderComparison() {
  if (!compareLeft.value || !compareRight.value || compareLeft.value === compareRight.value) {
    compareResult.textContent = "Choose two different observations to compare.";
    return;
  }
  const comparison = await fetch(`/api/compare?left=${encodeURIComponent(compareLeft.value)}&right=${encodeURIComponent(compareRight.value)}`).then((response) => response.json()) as { left: Job; right: Job };
  const signalRows = [
    ["FRESHNESS", comparison.left.analysis.freshness.label, comparison.right.analysis.freshness.label],
    ["TRANSPARENCY", `${comparison.left.analysis.transparencyScore}/100 · ${comparison.left.analysis.transparencySignals.filter((signal) => signal.observed).length}/12 signals`, `${comparison.right.analysis.transparencyScore}/100 · ${comparison.right.analysis.transparencySignals.filter((signal) => signal.observed).length}/12 signals`],
    ["APPLICATION BURDEN", `${comparison.left.analysis.requestedFieldCount} fields · ${comparison.left.analysis.resumeReentryLabel} re-entry`, `${comparison.right.analysis.requestedFieldCount} fields · ${comparison.right.analysis.resumeReentryLabel} re-entry`],
    ["LIFECYCLE", comparison.left.analysis.lifecycleState, comparison.right.analysis.lifecycleState],
    ["SOURCE CONFIDENCE", `${Math.round((comparison.left.sourceConfidence ?? 0) * 100)}%`, `${Math.round((comparison.right.sourceConfidence ?? 0) * 100)}%`],
  ];
  compareResult.classList.remove("empty");
  compareResult.innerHTML = `<div class="compare-table"><div class="compare-heading"><span></span><strong>${esc(comparison.left.title)}</strong><strong>${esc(comparison.right.title)}</strong></div>${signalRows.map(([label, left, right]) => `<div class="compare-row"><span class="compare-label">${esc(label)}</span><span>${esc(left)}</span><span>${esc(right)}</span></div>`).join("")}</div>`;
}

async function load() {
  const [summary, jobResponse] = await Promise.all([fetch("/api/summary").then((r) => r.json()), fetch("/api/jobs").then((r) => r.json())]);
  const jobsData = jobResponse as Job[];
  const runs = (summary.runs ?? []) as Array<{ sourceId: string; runKind: string; status: string; healthStatus: string; rowCount: number; observedAt: string; healthReport?: HealthReport }>;
  const lastKnownGood = (summary.lastKnownGood ?? []) as Array<{ sourceId: string; runKind: string; runId: string; rowCount: number; observedAt: string }>;
  const validationResults = (summary.validationResults ?? []) as Array<{ sourceId: string; oracleId: string; status: string; agreementRate: number | null; matchedCount: number; oracleCount: number }>;
  const healEvents = (summary.healEvents ?? []) as Array<{ sourceId: string; collectorId: string; reason: string; approved: boolean | null; repairedRunId: string | null; createdAt?: string }>;
  const catalog = (summary.sourceCatalog ?? []) as Array<{ sourceId: string; name: string; status: string; note: string; scope: { geography: string | null; department: string | null; careerStage: string | null; employmentType: string | null; boardKind: string } }>;
  const activeSources = catalog.filter((source) => source.status === "live" || source.status === "live_scoped");
  const boardSources = catalog.filter((source) => source.status === "live");
  const scopedSources = catalog.filter((source) => source.status === "live_scoped");
  const cards = catalog.map((source) => `<div class="health-card ${esc(source.status)}"><div class="health-source">${esc(source.name)}</div><div class="health-meta">${esc(source.status)} · scope ${esc(source.scope.boardKind)} · ${esc(source.note)}</div></div>`);
  const runCards = runs.map((run) => {
    const report = run.healthReport ?? {};
    const evidence = [
      `duplicateIdentityCount=${report.duplicateIdentityCount ?? 0}`,
      `duplicateUrlCount=${report.duplicateUrlCount ?? 0}`,
      `paginationErrors=${report.paginationErrors?.length ?? 0}`,
      ...(report.errors ?? []),
    ];
    return `<div class="health-card ${esc(run.status)}"><div class="health-source">Run: ${esc(run.sourceId)} · ${esc(run.runKind)}</div><div class="health-meta">${esc(run.status)} · healthStatus ${esc(run.healthStatus)} · ${esc(run.rowCount)} rows · ${esc(new Date(run.observedAt).toLocaleString())}</div><div class="health-meta"><span class="detail-label">HEALTH EVIDENCE</span> ${esc(evidence.join(" · "))}</div></div>`;
  });
  const lastKnownGoodCards = lastKnownGood.map((run) => `<div class="health-card success"><div class="health-source">LAST KNOWN GOOD · ${esc(run.sourceId)} · ${esc(run.runKind)}</div><div class="health-meta">${esc(run.rowCount)} rows · run ${esc(run.runId)} · ${esc(new Date(run.observedAt).toLocaleString())}</div></div>`);
  const validationCards = validationResults.map((result) => `<div class="health-card ${esc(result.status)}"><div class="health-source">Oracle: ${esc(result.sourceId)}</div><div class="health-meta">${esc(result.status)} · ${result.agreementRate === null ? "insufficient data" : `${result.matchedCount}/${result.oracleCount} IDs matched (${Math.round(result.agreementRate * 100)}%)`} · ${esc(result.oracleId)}</div></div>`);
  const healCards = healEvents.map((event) => `<div class="health-card ${event.approved === true ? "success" : event.approved === false ? "failed" : "live_scoped"}"><div class="health-source">HEAL REVIEW · ${esc(event.sourceId)}</div><div class="health-meta">${event.approved === null ? "awaiting approval" : event.approved ? "approved" : "rejected"} · ${esc(event.reason)} · collector ${esc(event.collectorId)}${event.repairedRunId ? ` · repaired run ${esc(event.repairedRunId)}` : ""}</div></div>`);
  health.innerHTML = [...cards, ...runCards, ...lastKnownGoodCards, ...healCards, ...validationCards].join("") || `<div class="muted">No collector runs recorded yet.</div>`;
  metrics.innerHTML = [
    ["OBSERVATIONS", jobsData.length],
    ["KNOWN SOURCE CONFIDENCE", `${Math.round((jobsData.reduce((sum, job) => sum + (job.sourceConfidence ?? 0), 0) / Math.max(jobsData.length, 1)) * 100)}%`],
    ["INFORMATION ASYMMETRY", jobsData.filter((job) => job.analysis.gapLabel === "information asymmetry").length],
    ["DATA MODE", jobsData.some((job) => job.dataMode === "live") ? "LIVE + FIXTURE" : "FIXTURE"],
    ["ACTIVE SOURCES", `${activeSources.length} (${boardSources.length} board · ${scopedSources.length} scoped)`],
    ["ORACLE VALIDATION", validationResults.length ? `${validationResults.filter((result) => result.status === "agree").length}/${validationResults.length} agree` : "NOT RUN"],
  ].map(([label, value]) => `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${esc(value)}</div></div>`).join("");
  count.textContent = `${jobsData.length} recorded observations`;
  const options = jobsData.map((job) => `<option value="${esc(job.observationId)}">${esc(job.title)} · ${esc(job.location)}</option>`).join("");
  compareLeft.innerHTML = options;
  compareRight.innerHTML = options;
  compareRun.disabled = jobsData.length < 2;
  if (jobsData.length > 1) {
    compareRight.selectedIndex = 1;
    compareRun.addEventListener("click", () => { void renderComparison(); });
    void renderComparison();
  }
  jobs.innerHTML = jobsData.length ? jobsData.map((job) => `<article class="job-card" data-id="${esc(job.observationId)}"><div class="job-top"><div><div class="job-title">${esc(job.title)}</div><div class="job-meta">${esc(job.location)} · ${esc(job.dataMode)} · source confidence ${Math.round((job.sourceConfidence ?? 0) * 100)}%</div></div><div><div class="job-gap">${esc(job.analysis.gapLabel)}</div><div class="job-state">LIFECYCLE · ${esc(job.analysis.lifecycleState)}</div><div class="job-freshness">FRESHNESS · ${esc(job.analysis.freshness.precision)}</div></div></div></article>`).join("") : `<div class="detail empty"><p>No observations loaded yet. Ingest the checked-in fixture or run a live Bright Data collector.</p></div>`;
  jobs.querySelectorAll<HTMLElement>(".job-card").forEach((card) => card.addEventListener("click", () => showDetail(card.dataset.id!)));
}

async function showDetail(id: string) {
  const job = await fetch(`/api/jobs/${encodeURIComponent(id)}`).then((r) => r.json()) as Job & { sourceUrl: string | null; url: string | null; applicationUrl: string | null; observedAt: string; provenance: Record<string, unknown>; fields?: { label: string; required: boolean | null }[]; events?: { eventType: string; observedAt: string; evidence?: { changes?: { field: string; before: unknown; after: unknown }[] } }[]; diffs?: { changes: { field: string; before: unknown; after: unknown }[] }[]; inferences?: { type: string; confidence: number; signals: string[] }[] };
  detail.classList.remove("empty");
  const provenance = Object.entries(job.provenance ?? {}).map(([field, value]) => {
    const raw = typeof value === "object" && value !== null && "raw" in value ? (value as { raw: unknown }).raw : "unknown";
    return `<li>${esc(field)}: ${esc(raw)}</li>`;
  }).join("");
  const application = job.applicationObservation;
  const transparencySummary = `<div class="detail-section"><div class="detail-label">TRANSPARENCY SCORE</div><p><strong>${job.analysis.transparencyScore}/100</strong> · ${job.analysis.transparencySignals.filter((signal: { observed: boolean }) => signal.observed).length}/12 public disclosure signals observed.</p><p class="muted">${esc(job.analysis.transparencyInterpretation)}</p><ul>${job.analysis.transparencySignals.map((signal: { label: string; points: number; observed: boolean; evidence: string | null }) => `<li>${signal.observed ? "✓" : "○"} ${esc(signal.label)} (${signal.points} points)${signal.evidence ? ` · ${esc(signal.evidence)}` : ""}</li>`).join("")}</ul></div>`;
  const applicationSummary = application ? `<div class="detail-section"><div class="detail-label">APPLICATION OBSERVATION</div><div class="detail-grid"><div><div class="detail-label">ACCOUNT GATE</div><div class="detail-value">${application.accountGate === null ? "unknown" : application.accountGate ? "required" : "not observed"}</div></div><div><div class="detail-label">RESUME REQUIRED</div><div class="detail-value">${application.resumeRequired === null ? "unknown" : application.resumeRequired ? "yes" : "no"}</div></div><div><div class="detail-label">REQUIRED FIELDS</div><div class="detail-value">${application.requiredFieldCount}</div></div><div><div class="detail-label">OPTIONAL FIELDS</div><div class="detail-value">${application.optionalFieldCount}</div></div><div><div class="detail-label">UNKNOWN FIELDS</div><div class="detail-value">${application.unknownFieldCount}</div></div><div><div class="detail-label">CUSTOM QUESTIONS</div><div class="detail-value">${application.customQuestionCount}</div></div><div><div class="detail-label">LONG ANSWERS</div><div class="detail-value">${application.longAnswerCount}</div></div><div><div class="detail-label">ATTACHMENTS</div><div class="detail-value">${application.attachmentCount}</div></div></div>${application.manualHistoryFields.length ? `<p>Manual history labels: ${application.manualHistoryFields.map(esc).join(", ")}</p>` : `<p>No manual history labels observed.</p>`}<p class="muted">Public form labels and metadata only; candidate-entered values are not collected.</p></div>` : `<div class="detail-section"><div class="detail-label">APPLICATION OBSERVATION</div><p>Not observed.</p></div>`;
  detail.innerHTML = `<p class="eyebrow">OBSERVATION EVIDENCE</p><h2>${esc(job.title)}</h2><p>${esc(job.location)} · ${esc(job.dataMode)} data · source confidence ${Math.round((job.sourceConfidence ?? 0) * 100)}%</p><div class="detail-section"><div class="detail-grid">${evidenceLink("Source URL", job.sourceUrl)}${evidenceLink("Listing URL", job.url)}${evidenceLink("Application URL", job.applicationUrl)}<div><div class="detail-label">Observed at</div><div class="detail-value">${esc(job.observedAt)}</div></div></div></div><div class="detail-section"><div class="detail-label">FRESHNESS</div><p>${esc(job.analysis.freshness.label)}</p><p>First observed by ApplySignal: ${esc(job.analysis.freshness.firstSeenAt)}</p></div><div class="detail-section"><div class="detail-label">LIFECYCLE</div><p class="lifecycle-state">${esc(job.analysis.lifecycleState)}</p><p>Lifecycle classification is separate from the Reciprocity Gap and source confidence.</p></div><div class="detail-section"><div class="detail-label">Disclosed categories</div><div class="detail-grid"><div><div class="detail-label">Count</div><div class="detail-value">${job.analysis.disclosedCount}</div></div><div><div class="detail-label">Requested fields</div><div class="detail-value">${job.analysis.requestedFieldCount}</div></div></div><p><strong>${esc(job.analysis.gapLabel)}</strong><br>${esc(job.analysis.explanation)}</p></div><div class="detail-section"><div class="detail-label">RESUME RE-ENTRY TAX</div><p>${esc(job.analysis.resumeReentryLabel)} · ${job.analysis.resumeReentryFieldCount} overlapping fields requested in addition to a resume.</p></div><div class="detail-section"><div class="detail-label">TALENT POOL / EVERGREEN FLAGS</div><p>TALENT POOL: ${job.flags.talentPool ? "yes" : "no"} · EXPLICIT EVERGREEN: ${job.flags.explicitEvergreen ? "yes" : "no"} · EVERGREEN-LIKE: ${job.flags.evergreenLike ? "yes" : "no"} · MULTIPLE OPENINGS: ${job.flags.multipleOpenings ? "yes" : "no"}</p></div>${applicationSummary}<div class="detail-section"><div class="detail-label">RAW OBSERVED FIELDS</div>${provenance ? `<ul>${provenance}</ul>` : `<p>No raw field labels stored.</p>`}</div><div class="detail-section"><div class="detail-label">Application burden fields</div>${job.fields?.length ? `<ul>${job.fields.map((field: { label: string; required: boolean | null }) => `<li>${esc(field.label)} ${field.required === true ? "(required)" : field.required === false ? "(optional)" : "(unknown)"}</li>`).join("")}</ul>` : `<p>Not observed.</p>`}</div><div class="detail-section"><div class="detail-label">PERSISTED LIFECYCLE EVENTS</div>${job.events?.length ? `<ul>${job.events.map((event: { eventType: string; observedAt: string; evidence?: { changes?: { field: string; before: unknown; after: unknown }[] } }) => `<li><span class="badge inferred">${esc(event.eventType)}</span> ${esc(event.observedAt)}${event.evidence?.changes?.length ? ` · ${esc(event.evidence.changes.map((change) => `${change.field}: ${change.before} → ${change.after}`).join("; "))}` : ""}</li>`).join("")}</ul>` : `<p>No persisted lifecycle events.</p>`}</div><div class="detail-section"><div class="detail-label">Lifecycle changes</div>${job.diffs?.length ? `<ul>${job.diffs.flatMap((diff: { changes: { field: string; before: unknown; after: unknown }[] }) => diff.changes.map((change) => `<li>${esc(change.field)}: ${esc(change.before)} → ${esc(change.after)}</li>`)).join("")}</ul>` : `<p>No comparison observations.</p>`}</div><div class="detail-section"><div class="detail-label">Inferences</div>${job.inferences?.length ? `<ul>${job.inferences.map((inference: { type: string; confidence: number; signals: string[] }) => `<li><span class="badge inferred">${esc(inference.type)}</span> ${Math.round(inference.confidence * 100)}% confidence — ${esc(inference.signals.join("; "))}</li>`).join("")}</ul>` : `<p>No bounded relationship inference.</p>`}</div>`;
  detail.insertAdjacentHTML("beforeend", transparencySummary);
}

load().catch((error) => { detail.innerHTML = `<p>Dashboard error: ${esc(error)}</p>`; });
