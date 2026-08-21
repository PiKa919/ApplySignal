const metrics = document.querySelector("#metrics")!;
const jobs = document.querySelector("#jobs")!;
const detail = document.querySelector("#detail")!;
const count = document.querySelector("#count")!;
const health = document.querySelector("#health")!;
const compareLeft = document.querySelector<HTMLSelectElement>("#compare-left")!;
const compareRight = document.querySelector<HTMLSelectElement>("#compare-right")!;
const compareRun = document.querySelector<HTMLButtonElement>("#compare-run")!;
const compareResult = document.querySelector<HTMLElement>("#compare-result")!;
const dashboardStatus = document.querySelector<HTMLElement>("#dashboard-status")!;
const jobSort = document.querySelector<HTMLSelectElement>("#job-sort")!;
const researchForm = document.querySelector<HTMLFormElement>("#research-form")!;
const researchUrl = document.querySelector<HTMLInputElement>("#research-url")!;
const researchMessage = document.querySelector<HTMLElement>("#research-message")!;
const researchQueue = document.querySelector<HTMLElement>("#research-queue")!;

type ApplicationObservation = { formUrl: string | null; accountGate: boolean | null; resumeRequired: boolean | null; requiredFieldCount: number; optionalFieldCount: number; unknownFieldCount: number; customQuestionCount: number; longAnswerCount: number; attachmentCount: number; manualHistoryFields: string[] };
type HealthReport = { errors?: string[]; duplicateIdentityCount?: number; duplicateUrlCount?: number; paginationErrors?: string[]; distributions?: Record<string, Record<string, number>> };
type Job = { observationId: string; sourceId: string; title: string | null; companyName: string; location: string | null; url: string | null; applicationUrl: string | null; observedAt: string; postedDate: string | null; postedDateQuality: string; dataMode: string; sourceConfidence: number | null; flags: { explicitEvergreen: boolean; evergreenLike: boolean; talentPool: boolean; multipleOpenings: boolean }; applicationObservation?: ApplicationObservation | null; analysis: { gapLabel: string; explanation: string; requestedFieldCount: number; disclosedCount: number; resumeReentryFieldCount: number; resumeReentryLabel: string; transparencyScore: number; transparencySignals: { key: string; label: string; points: number; observed: boolean; evidence: string | null }[]; transparencyInterpretation: string; lifecycleState: string; freshness: { precision: string; label: string; sourcePublishedAt: string | null; ageDays: number | null; ageMinDays: number | null; firstSeenAt: string } } };
type SortMode = "posted-desc" | "company-asc" | "company-desc";
type ResearchQueueItem = { id: string; url: string; status: string; attempts: number; submittedAt: string; updatedAt: string; observationId: string | null; lastError: string | null };

const esc = (value: unknown) => String(value ?? "Unknown").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]!));
const safeHref = (value: unknown): string | null => {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? esc(parsed.toString()) : null;
  } catch {
    return null;
  }
};
const confidenceLabel = (value: number | null | undefined): string => typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "Unknown";
const sortJobsByPostedDate = <T extends { observationId: string; observedAt: string; postedDate: string | null; postedDateQuality: string }>(jobs: T[]): T[] => [...jobs].sort((left, right) => {
  const leftPosted = left.postedDateQuality === "exact" && left.postedDate ? left.postedDate : null;
  const rightPosted = right.postedDateQuality === "exact" && right.postedDate ? right.postedDate : null;
  if (leftPosted && rightPosted) return rightPosted.localeCompare(leftPosted) || right.observedAt.localeCompare(left.observedAt) || left.observationId.localeCompare(right.observationId);
  if (leftPosted) return -1;
  if (rightPosted) return 1;
  return right.observedAt.localeCompare(left.observedAt) || left.observationId.localeCompare(right.observationId);
});
const postedDateLabel = (job: { postedDate: string | null; postedDateQuality: string }): string => job.postedDateQuality === "exact" && job.postedDate ? `Posted · ${job.postedDate}` : "Posted date unavailable";
const sortJobsByMode = (jobs: Job[], mode: SortMode): Job[] => mode === "posted-desc" ? sortJobsByPostedDate(jobs) : [...jobs].sort((left, right) => {
  const companyOrder = left.companyName.localeCompare(right.companyName, undefined, { sensitivity: "base" });
  return (mode === "company-asc" ? companyOrder : -companyOrder) || (left.title ?? "").localeCompare(right.title ?? "", undefined, { sensitivity: "base" }) || right.observedAt.localeCompare(left.observedAt);
});
async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  let payload: unknown = null;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`Request failed (${response.status})`);
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload ? String((payload as { error: unknown }).error) : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}
const renderResearchQueue = (items: ResearchQueueItem[]) => {
  researchQueue.innerHTML = items.length ? items.map((item) => `<div class="research-item"><div><strong>${esc(item.url)}</strong><span class="research-status ${esc(item.status)}">${esc(item.status)}</span></div><div class="research-item-meta">${item.observationId ? `Observation ready · ${esc(item.observationId)}` : item.lastError ? `Retryable error · ${esc(item.lastError)}` : `Submitted ${esc(new Date(item.submittedAt).toLocaleString())}`}</div></div>`).join("") : `<p class="muted">No submitted job links yet.</p>`;
};
const loadResearchQueue = async () => {
  try { renderResearchQueue(await apiJson<ResearchQueueItem[]>("/api/research-queue")); }
  catch (error) { researchQueue.innerHTML = `<p class="muted">Research queue unavailable: ${esc(error instanceof Error ? error.message : "request failed")}</p>`; }
};
const setDashboardStatus = (message: string, kind: "loading" | "error" | "ready") => {
  dashboardStatus.className = `dashboard-status ${kind}`;
  dashboardStatus.hidden = kind === "ready";
  dashboardStatus.innerHTML = kind === "error" ? `<span>${esc(message)}</span><button id="dashboard-retry" type="button">Retry</button>` : `<span>${esc(message)}</span>`;
  dashboardStatus.querySelector<HTMLButtonElement>("#dashboard-retry")?.addEventListener("click", () => { void load(); });
};
const setLoadingState = () => {
  setDashboardStatus("Loading live observations…", "loading");
  metrics.innerHTML = `<div class="loading-state" role="status">Loading signal summary…</div>`;
  health.innerHTML = `<div class="loading-state" role="status">Loading source health…</div>`;
  jobs.innerHTML = `<div class="loading-state" role="status">Loading live listings…</div>`;
  detail.innerHTML = `<p class="eyebrow">LOADING</p><h2>Preparing evidence</h2><p>Loading verified live observations.</p>`;
  count.textContent = "Loading…";
  compareLeft.innerHTML = `<option>Loading observations…</option>`;
  compareRight.innerHTML = `<option>Loading observations…</option>`;
  compareRun.disabled = true;
  compareResult.className = "compare-result empty";
  compareResult.textContent = "Loading comparison options…";
  researchQueue.innerHTML = `<div class="loading-state" role="status">Loading submitted research links…</div>`;
};
const renderDashboardError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "The live observation service did not respond.";
  setDashboardStatus(`Couldn’t load live observations: ${message}`, "error");
  metrics.innerHTML = `<div class="dashboard-error"><strong>Live data is temporarily unavailable.</strong><span>Retry to check the observation service again.</span></div>`;
  health.innerHTML = `<div class="dashboard-error"><strong>Source health unavailable.</strong><span>Retry to reload collector status.</span></div>`;
  jobs.innerHTML = `<div class="dashboard-error"><strong>Couldn’t load live listings.</strong><span>Use Retry above to try again.</span></div>`;
  detail.innerHTML = `<p class="eyebrow">LIVE DATA UNAVAILABLE</p><h2>Evidence is temporarily unavailable</h2><p>Retry when the observation service is reachable.</p>`;
  count.textContent = "Live observations unavailable";
  compareLeft.innerHTML = `<option>Unavailable</option>`;
  compareRight.innerHTML = `<option>Unavailable</option>`;
  compareRun.disabled = true;
  compareResult.className = "compare-result empty";
  compareResult.textContent = "Comparison is unavailable until live observations load.";
  researchQueue.innerHTML = `<p class="muted">Research queue unavailable.</p>`;
};
const renderDetailError = (error: unknown, id: string) => {
  const message = error instanceof Error ? error.message : "The observation could not be loaded.";
  detail.classList.add("empty");
  detail.innerHTML = `<p class="eyebrow">DETAIL UNAVAILABLE</p><h2>Couldn’t load this observation</h2><p>${esc(message)}</p><button class="inline-retry" type="button">Retry</button>`;
  detail.querySelector("button")?.addEventListener("click", () => { void showDetail(id); });
};
const renderConfidenceMetric = (jobs: Job[]): string => {
  const known = jobs.map((job) => job.sourceConfidence).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return known.length ? confidenceLabel(known.reduce((sum, value) => sum + value, 0) / known.length) : "Unknown";
};
const evidenceLink = (label: string, value: unknown): string => {
  const href = safeHref(value);
  return `<div><div class="detail-label">${esc(label)}</div><div class="detail-value">${href ? `<a href="${href}" target="_blank" rel="noreferrer">Open evidence</a>` : esc(value)}</div></div>`;
};
const roleHeading = (job: Job): string => `<div class="compare-role"><strong>${esc(job.title)}</strong><span>${esc(job.companyName)} · ${esc(job.location)}</span>${safeHref(job.url) ? `<a href="${safeHref(job.url)}" target="_blank" rel="noreferrer">Open listing</a>` : `<span class="muted">Listing link not observed</span>`}</div>`;

async function renderComparison() {
  if (!compareLeft.value || !compareRight.value || compareLeft.value === compareRight.value) {
    compareResult.textContent = "Choose two different observations to compare.";
    return;
  }
  compareRun.disabled = true;
  compareRun.textContent = "Comparing…";
  compareResult.className = "compare-result empty";
  compareResult.textContent = "Loading independent signals…";
  try {
    const comparison = await apiJson<{ left: Job; right: Job }>(`/api/compare?left=${encodeURIComponent(compareLeft.value)}&right=${encodeURIComponent(compareRight.value)}`);
    const signalRows = [
      ["FRESHNESS", comparison.left.analysis.freshness.label, comparison.right.analysis.freshness.label],
      ["TRANSPARENCY", `${comparison.left.analysis.transparencyScore}/100 · ${comparison.left.analysis.transparencySignals.filter((signal) => signal.observed).length}/12 signals`, `${comparison.right.analysis.transparencyScore}/100 · ${comparison.right.analysis.transparencySignals.filter((signal) => signal.observed).length}/12 signals`],
      ["APPLICATION BURDEN", `${comparison.left.analysis.requestedFieldCount} fields · ${comparison.left.analysis.resumeReentryLabel} re-entry`, `${comparison.right.analysis.requestedFieldCount} fields · ${comparison.right.analysis.resumeReentryLabel} re-entry`],
      ["LIFECYCLE", comparison.left.analysis.lifecycleState, comparison.right.analysis.lifecycleState],
      ["SOURCE CONFIDENCE", confidenceLabel(comparison.left.sourceConfidence), confidenceLabel(comparison.right.sourceConfidence)],
    ];
    compareResult.className = "compare-result";
    compareResult.innerHTML = `<div class="compare-table"><div class="compare-heading"><span></span>${roleHeading(comparison.left)}${roleHeading(comparison.right)}</div>${signalRows.map(([label, left, right]) => `<div class="compare-row"><span class="compare-label">${esc(label)}</span><span>${esc(left)}</span><span>${esc(right)}</span></div>`).join("")}</div>`;
  } catch (error) {
    compareResult.className = "compare-result empty compare-error";
    compareResult.innerHTML = `<span>Couldn’t compare these observations: ${esc(error instanceof Error ? error.message : "request failed")}</span> <button id="compare-retry" type="button">Retry comparison</button>`;
    compareResult.querySelector("button")?.addEventListener("click", () => { void renderComparison(); });
  } finally {
    compareRun.disabled = false;
    compareRun.textContent = "Compare evidence";
  }
}

async function load() {
  setLoadingState();
  try {
    const [summary, jobsData] = await Promise.all([apiJson<{
      runs?: Array<{ sourceId: string; runKind: string; status: string; healthStatus: string; rowCount: number; observedAt: string; healthReport?: HealthReport }>;
      lastKnownGood?: Array<{ sourceId: string; runKind: string; runId: string; rowCount: number; observedAt: string }>;
      validationResults?: Array<{ sourceId: string; oracleId: string; status: string; agreementRate: number | null; matchedCount: number; oracleCount: number }>;
      healEvents?: Array<{ sourceId: string; collectorId: string; reason: string; approved: boolean | null; repairedRunId: string | null; createdAt?: string }>;
      sourceCatalog?: Array<{ sourceId: string; name: string; url: string; status: string; note: string; sourceFamily: string; collectorId: string | null; oracleId: string | null; scope: { geography: string | null; department: string | null; careerStage: string | null; employmentType: string | null; boardKind: string } }>;
    }>("/api/summary"), apiJson<Job[]>("/api/jobs")]);
  const runs = summary.runs ?? [];
  const lastKnownGood = summary.lastKnownGood ?? [];
  const validationResults = summary.validationResults ?? [];
  const healEvents = summary.healEvents ?? [];
  const catalog = summary.sourceCatalog ?? [];
  const activeSources = catalog.filter((source) => source.status === "live" || source.status === "live_scoped");
  const boardSources = catalog.filter((source) => source.status === "live");
  const scopedSources = catalog.filter((source) => source.status === "live_scoped");
  const sortedJobs = sortJobsByPostedDate(jobsData);
  const liveSourceIds = new Set(sortedJobs.map((job) => job.sourceId));
  const cards = catalog.map((source) => `<div class="health-card ${esc(source.status)}"><div class="health-card-top"><div class="health-source">${esc(source.name)}</div><span class="status-pill">${esc(source.status.replaceAll("_", " "))}</span></div><div class="health-meta">${esc(source.sourceFamily)} · ${esc(source.scope.boardKind.replaceAll("_", " "))}</div>${safeHref(source.url) ? `<a class="health-link" href="${safeHref(source.url)}" target="_blank" rel="noreferrer">Open career site</a>` : ""}<details><summary>Why this status?</summary><p>${esc(source.note)}</p></details></div>`);
  const runCards = runs.map((run) => {
    const report = run.healthReport ?? {};
    const evidence = [
      `duplicateIdentityCount=${report.duplicateIdentityCount ?? 0}`,
      `duplicateUrlCount=${report.duplicateUrlCount ?? 0}`,
      `paginationErrors=${report.paginationErrors?.length ?? 0}`,
      ...(report.errors ?? []),
    ];
    return `<div class="health-card ${esc(run.status)}"><div class="health-card-top"><div class="health-source">${esc(run.sourceId)} · ${esc(run.runKind)}</div><span class="status-pill">${esc(run.healthStatus ?? run.status)}</span></div><div class="health-meta">${esc(run.rowCount)} rows · ${esc(new Date(run.observedAt).toLocaleString())}</div><details><summary>Health evidence</summary><p>${esc(evidence.join(" · "))}</p></details></div>`;
  });
  const lastKnownGoodCards = lastKnownGood.map((run) => `<div class="health-card success"><div class="health-card-top"><div class="health-source">${esc(run.sourceId)} · last known good</div><span class="status-pill">healthy</span></div><div class="health-meta">${esc(run.rowCount)} rows · ${esc(new Date(run.observedAt).toLocaleString())}</div></div>`);
  const validationCards = validationResults.map((result) => `<div class="health-card ${esc(result.status)}"><div class="health-source">Oracle: ${esc(result.sourceId)}</div><div class="health-meta">${esc(result.status)} · ${result.agreementRate === null ? "insufficient data" : `${result.matchedCount}/${result.oracleCount} IDs matched (${Math.round(result.agreementRate * 100)}%)`} · ${esc(result.oracleId)}</div></div>`);
  const healCards = healEvents.map((event) => `<div class="health-card ${event.approved === true ? "success" : event.approved === false ? "failed" : "live_scoped"}"><div class="health-source">HEAL REVIEW · ${esc(event.sourceId)}</div><div class="health-meta">${event.approved === null ? "awaiting approval" : event.approved ? "approved" : "rejected"} · ${esc(event.reason)} · collector ${esc(event.collectorId)}${event.repairedRunId ? ` · repaired run ${esc(event.repairedRunId)}` : ""}</div></div>`);
  health.innerHTML = `<div class="health-group"><div class="health-group-heading"><strong>Employer signals</strong><span>source readiness and public board links</span></div><div class="health-list">${cards.join("")}</div></div><div class="health-group"><div class="health-group-heading"><strong>Run status</strong><span>transport and extraction health only</span></div><div class="health-list">${[...runCards, ...lastKnownGoodCards, ...healCards, ...validationCards].join("") || `<div class="muted">No collector runs recorded yet.</div>`}</div></div>`;
  metrics.innerHTML = [
    ["OBSERVATIONS", sortedJobs.length],
    ["KNOWN SOURCE CONFIDENCE", renderConfidenceMetric(sortedJobs)],
    ["INFORMATION ASYMMETRY", sortedJobs.filter((job) => job.analysis.gapLabel === "information asymmetry").length],
    ["DATA MODE", sortedJobs.length ? "LIVE" : "NO LIVE DATA"],
    ["ACTIVE SOURCES MONITORED", `${activeSources.length} (${boardSources.length} board · ${scopedSources.length} scoped)`],
    ["SOURCES WITH LIVE LISTINGS", liveSourceIds.size],
    ["ORACLE VALIDATION", validationResults.length ? `${validationResults.filter((result) => result.status === "agree").length}/${validationResults.length} agree` : "NOT RUN"],
  ].map(([label, value]) => `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${esc(value)}</div></div>`).join("");
  count.textContent = `${sortedJobs.length} recorded observations · sorted by newest posted date`;
  const options = sortedJobs.map((job) => `<option value="${esc(job.observationId)}">${esc(job.title)} · ${esc(job.companyName)} · ${esc(job.location)} · ${esc(postedDateLabel(job))}</option>`).join("");
  compareLeft.innerHTML = options;
  compareRight.innerHTML = options;
  compareRun.disabled = sortedJobs.length < 2;
  compareRun.onclick = () => { void renderComparison(); };
  if (sortedJobs.length > 1) {
    compareRight.selectedIndex = 1;
    void renderComparison();
  } else {
    compareResult.className = "compare-result empty";
    compareResult.textContent = sortedJobs.length ? "Add another live observation to compare evidence." : "No live observations are available to compare yet.";
  }
  jobs.innerHTML = sortedJobs.length ? sortedJobs.map((job) => `<article class="job-card" data-id="${esc(job.observationId)}" tabindex="0" role="button" aria-label="View evidence for ${esc(job.title)} at ${esc(job.companyName)} in ${esc(job.location)}"><div class="job-top"><div><div class="job-title">${esc(job.title)}</div><div class="job-company">${esc(job.companyName)}</div><div class="job-meta">${esc(job.location)} · ${esc(postedDateLabel(job))} · ${esc(job.dataMode).toUpperCase()} · source confidence ${confidenceLabel(job.sourceConfidence)}</div>${safeHref(job.url) ? `<a class="job-link" href="${safeHref(job.url)}" target="_blank" rel="noreferrer">Open listing ↗</a>` : `<span class="job-link job-link-missing">Listing link not observed</span>`}</div><div><div class="job-gap">${esc(job.analysis.gapLabel)}</div><div class="job-state">LIFECYCLE · ${esc(job.analysis.lifecycleState)}</div><div class="job-freshness">FRESHNESS · ${esc(job.analysis.freshness.precision)}</div></div></div></article>`).join("") : `<div class="empty-state"><strong>No verified live listings are available right now.</strong><span>The collectors are reachable, but no live rows are currently stored. Check the run status above or retry the dashboard.</span><button class="inline-retry" type="button">Retry</button></div>`;
  jobs.querySelector<HTMLButtonElement>(".inline-retry")?.addEventListener("click", () => { void load(); });
  jobs.querySelectorAll<HTMLElement>(".job-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("a")) return;
      void showDetail(card.dataset.id!);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void showDetail(card.dataset.id!);
    });
    card.querySelectorAll("a").forEach((link) => link.addEventListener("click", (event) => event.stopPropagation()));
  });
  const applySort = () => {
    const mode = jobSort.value as SortMode;
    const sorted = sortJobsByMode(jobsData, mode);
    const leftId = compareLeft.value;
    const rightId = compareRight.value;
    const cardsById = new Map([...jobs.querySelectorAll<HTMLElement>(".job-card")].map((card) => [card.dataset.id, card]));
    for (const job of sorted) {
      const card = cardsById.get(job.observationId);
      if (card) jobs.append(card);
    }
    const sortedOptions = sorted.map((job) => `<option value="${esc(job.observationId)}">${esc(job.title)} · ${esc(job.companyName)} · ${esc(job.location)} · ${esc(postedDateLabel(job))}</option>`).join("");
    compareLeft.innerHTML = sortedOptions;
    compareRight.innerHTML = sortedOptions;
    if (sorted.some((job) => job.observationId === leftId)) compareLeft.value = leftId;
    if (sorted.some((job) => job.observationId === rightId)) compareRight.value = rightId;
    if (compareLeft.value === compareRight.value && sorted.length > 1) compareRight.selectedIndex = 1;
    const label = mode === "company-asc" ? "sorted by company name A–Z" : mode === "company-desc" ? "sorted by company name Z–A" : "sorted by newest posted date";
    count.textContent = `${sorted.length} recorded observations · ${label}`;
  };
  jobSort.onchange = applySort;
  if (sortedJobs.length) {
    detail.classList.add("empty");
    detail.innerHTML = `<p class="eyebrow">SELECT AN OBSERVATION</p><h2>Evidence appears here</h2><p>Choose a role to inspect disclosure, application burden, lifecycle changes, and source confidence.</p>`;
  }
  if (!jobsData.length) {
    const lastRun = runs.find((run) => run.status === "success");
    const lastRunText = lastRun ? `Last successful run: ${lastRun.sourceId} · ${new Date(lastRun.observedAt).toLocaleString()}.` : "No successful collector run is recorded yet.";
    detail.classList.add("empty");
    detail.innerHTML = `<p class="eyebrow">NO LIVE OBSERVATIONS</p><h2>Nothing verified to show yet</h2><p>${esc(lastRunText)} Review collector health above, then retry when a live run is available.</p>`;
  }
  setDashboardStatus("Live observations loaded", "ready");
  void loadResearchQueue();
  } catch (error) {
    renderDashboardError(error);
  }
}

researchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  researchMessage.className = "research-message";
  researchMessage.textContent = "Adding link to the research queue…";
  const url = researchUrl.value.trim();
  try {
    const response = await apiJson<{ duplicate: boolean; item: ResearchQueueItem }>("/api/research-queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    researchMessage.className = "research-message success";
    researchMessage.textContent = response.duplicate ? "This link is already in the research queue." : "Queued. It will be researched by the scheduled worker.";
    researchUrl.value = "";
    await loadResearchQueue();
  } catch (error) {
    researchMessage.className = "research-message error";
    researchMessage.textContent = error instanceof Error ? error.message : "Could not queue this link.";
  }
});

async function showDetail(id: string) {
  try {
  const job = await apiJson<Job & { sourceUrl: string | null; url: string | null; applicationUrl: string | null; observedAt: string; provenance: Record<string, unknown>; fields?: { label: string; required: boolean | null }[]; events?: { eventType: string; observedAt: string; evidence?: { changes?: { field: string; before: unknown; after: unknown }[] } }[]; diffs?: { changes: { field: string; before: unknown; after: unknown }[] }[]; inferences?: { type: string; confidence: number; signals: string[] }[]; lineageEdges?: { fromObservationId: string; toObservationId: string; relation: string; confidence: number; algorithmVersion: string; evidence?: { signals?: string[] } }[] }>(`/api/jobs/${encodeURIComponent(id)}`);
  detail.classList.remove("empty");
  const provenance = Object.entries(job.provenance ?? {}).map(([field, value]) => {
    const raw = typeof value === "object" && value !== null && "raw" in value ? (value as { raw: unknown }).raw : "unknown";
    return `<li>${esc(field)}: ${esc(raw)}</li>`;
  }).join("");
  const application = job.applicationObservation;
  const transparencySummary = `<div class="detail-section"><div class="detail-label">TRANSPARENCY SCORE</div><p><strong>${job.analysis.transparencyScore}/100</strong> · ${job.analysis.transparencySignals.filter((signal: { observed: boolean }) => signal.observed).length}/12 public disclosure signals observed.</p><p class="muted">${esc(job.analysis.transparencyInterpretation)}</p><ul>${job.analysis.transparencySignals.map((signal: { label: string; points: number; observed: boolean; evidence: string | null }) => `<li>${signal.observed ? "✓" : "○"} ${esc(signal.label)} (${signal.points} points)${signal.evidence ? ` · ${esc(signal.evidence)}` : ""}</li>`).join("")}</ul></div>`;
  const applicationSummary = application ? `<div class="detail-section"><div class="detail-label">APPLICATION OBSERVATION</div>${evidenceLink("PUBLIC FORM", application.formUrl)}<div class="detail-grid"><div><div class="detail-label">ACCOUNT GATE</div><div class="detail-value">${application.accountGate === null ? "unknown" : application.accountGate ? "required" : "not observed"}</div></div><div><div class="detail-label">RESUME REQUIRED</div><div class="detail-value">${application.resumeRequired === null ? "unknown" : application.resumeRequired ? "yes" : "no"}</div></div><div><div class="detail-label">REQUIRED FIELDS</div><div class="detail-value">${application.requiredFieldCount}</div></div><div><div class="detail-label">OPTIONAL FIELDS</div><div class="detail-value">${application.optionalFieldCount}</div></div><div><div class="detail-label">UNKNOWN FIELDS</div><div class="detail-value">${application.unknownFieldCount}</div></div><div><div class="detail-label">CUSTOM QUESTIONS</div><div class="detail-value">${application.customQuestionCount}</div></div><div><div class="detail-label">LONG ANSWERS</div><div class="detail-value">${application.longAnswerCount}</div></div><div><div class="detail-label">ATTACHMENTS</div><div class="detail-value">${application.attachmentCount}</div></div></div>${application.manualHistoryFields.length ? `<p>Manual history labels: ${application.manualHistoryFields.map(esc).join(", ")}</p>` : `<p>No manual history labels observed.</p>`}<p class="muted">Public form labels and metadata only; candidate-entered values are not collected.</p></div>` : `<div class="detail-section"><div class="detail-label">APPLICATION OBSERVATION</div><p>Not observed.</p></div>`;
  const lineageSummary = `<div class="detail-section"><div class="detail-label">PERSISTED LINEAGE EDGES</div>${job.lineageEdges?.length ? `<ul>${job.lineageEdges.map((edge) => `<li><span class="badge inferred">${esc(edge.relation)}</span> ${Math.round(edge.confidence * 100)}% confidence · ${esc(edge.algorithmVersion)} · ${esc((edge.evidence?.signals ?? []).join("; "))}</li>`).join("")}</ul>` : `<p>No persisted lineage edges.</p>`}</div>`;
  detail.innerHTML = `<p class="eyebrow">OBSERVATION EVIDENCE</p><h2>${esc(job.title)}</h2><p class="detail-company">${esc(job.companyName)} · ${esc(job.location)}</p><p>${esc(job.dataMode).toUpperCase()} observation · source confidence ${confidenceLabel(job.sourceConfidence)}</p><div class="detail-section"><div class="detail-grid">${evidenceLink("Source URL", job.sourceUrl)}${evidenceLink("Listing URL", job.url)}${evidenceLink("Application URL", job.applicationUrl)}<div><div class="detail-label">Observed at</div><div class="detail-value">${esc(job.observedAt)}</div></div></div></div><div class="detail-section"><div class="detail-label">FRESHNESS</div><p>${esc(job.analysis.freshness.label)}</p><p>First observed by ApplySignal: ${esc(job.analysis.freshness.firstSeenAt)}</p></div><div class="detail-section"><div class="detail-label">LIFECYCLE</div><p class="lifecycle-state">${esc(job.analysis.lifecycleState)}</p><p>Lifecycle classification is separate from the Reciprocity Gap and source confidence.</p></div><div class="detail-section"><div class="detail-label">Disclosed categories</div><div class="detail-grid"><div><div class="detail-label">Count</div><div class="detail-value">${job.analysis.disclosedCount}</div></div><div><div class="detail-label">Requested fields</div><div class="detail-value">${job.analysis.requestedFieldCount}</div></div></div><p><strong>${esc(job.analysis.gapLabel)}</strong><br>${esc(job.analysis.explanation)}</p></div><div class="detail-section"><div class="detail-label">RESUME RE-ENTRY TAX</div><p>${esc(job.analysis.resumeReentryLabel)} · ${job.analysis.resumeReentryFieldCount} overlapping fields requested in addition to a resume.</p></div><div class="detail-section"><div class="detail-label">TALENT POOL / EVERGREEN FLAGS</div><p>TALENT POOL: ${job.flags.talentPool ? "yes" : "no"} · EXPLICIT EVERGREEN: ${job.flags.explicitEvergreen ? "yes" : "no"} · EVERGREEN-LIKE: ${job.flags.evergreenLike ? "yes" : "no"} · MULTIPLE OPENINGS: ${job.flags.multipleOpenings ? "yes" : "no"}</p></div>${applicationSummary}<div class="detail-section"><div class="detail-label">RAW OBSERVED FIELDS</div>${provenance ? `<ul>${provenance}</ul>` : `<p>No raw field labels stored.</p>`}</div><div class="detail-section"><div class="detail-label">Application burden fields</div>${job.fields?.length ? `<ul>${job.fields.map((field: { label: string; required: boolean | null }) => `<li>${esc(field.label)} ${field.required === true ? "(required)" : field.required === false ? "(optional)" : "(unknown)"}</li>`).join("")}</ul>` : `<p>Not observed.</p>`}</div><div class="detail-section"><div class="detail-label">PERSISTED LIFECYCLE EVENTS</div>${job.events?.length ? `<ul>${job.events.map((event: { eventType: string; observedAt: string; evidence?: { changes?: { field: string; before: unknown; after: unknown }[] } }) => `<li><span class="badge inferred">${esc(event.eventType)}</span> ${esc(event.observedAt)}${event.evidence?.changes?.length ? ` · ${esc(event.evidence.changes.map((change) => `${change.field}: ${change.before} → ${change.after}`).join("; "))}` : ""}</li>`).join("")}</ul>` : `<p>No persisted lifecycle events.</p>`}</div><div class="detail-section"><div class="detail-label">Lifecycle changes</div>${job.diffs?.length ? `<ul>${job.diffs.flatMap((diff: { changes: { field: string; before: unknown; after: unknown }[] }) => diff.changes.map((change) => `<li>${esc(change.field)}: ${esc(change.before)} → ${esc(change.after)}</li>`)).join("")}</ul>` : `<p>No comparison observations.</p>`}</div><div class="detail-section"><div class="detail-label">Inferences</div>${job.inferences?.length ? `<ul>${job.inferences.map((inference: { type: string; confidence: number; signals: string[] }) => `<li><span class="badge inferred">${esc(inference.type)}</span> ${Math.round(inference.confidence * 100)}% confidence — ${esc(inference.signals.join("; "))}</li>`).join("")}</ul>` : `<p>No bounded relationship inference.</p>`}</div>`;
  detail.insertAdjacentHTML("beforeend", lineageSummary + transparencySummary);
  } catch (error) {
    renderDetailError(error, id);
  }
}

void load();
