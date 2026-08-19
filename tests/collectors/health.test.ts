import { expect, test } from "bun:test";
import { assessCollectorRows, buildHealDiagnosis, compareDistributionalHealth } from "../../src/collectors/health";

test("quarantines a structurally anomalous run despite a healthy row count", () => {
  const report = assessCollectorRows([
    { job_id: "A", title: "Backend", location: "Bengaluru", url: "https://jobs.example.test/A" },
    { job_id: "A", title: "Designer", location: null, url: "https://jobs.example.test/A" },
  ], {
    minimumRows: 2,
    requiredFields: ["job_id", "title", "location"],
    identityField: "job_id",
    expectedHost: "jobs.example.test",
    minimumCoverage: 0.75,
  });

  expect(report.status).toBe("quarantined");
  expect(report.duplicateIdentityCount).toBe(1);
  expect(report.fieldCoverage.location).toBe(0.5);
  expect(report.errors).toEqual(expect.arrayContaining([
    "duplicate identity values detected",
    "field coverage below threshold: location",
  ]));
});

test("accepts a complete run and keeps coverage as evidence", () => {
  const report = assessCollectorRows([
    { job_id: "A", title: "Backend", location: "Bengaluru", url: "https://jobs.example.test/A" },
    { job_id: "B", title: "Designer", location: "Pune", url: "https://jobs.example.test/B" },
  ], { minimumRows: 2, requiredFields: ["job_id", "title", "location"], identityField: "job_id", expectedHost: "jobs.example.test" });

  expect(report.status).toBe("healthy");
  expect(report.fieldCoverage).toEqual({ job_id: 1, title: 1, location: 1 });
  expect(report.distributions).toEqual({ location: { Bengaluru: 0.5, Pune: 0.5 } });
  expect(report.errors).toEqual([]);
});

test("quarantines obvious title and location field swaps", () => {
  const report = assessCollectorRows([
    { job_id: "A", title: "Bengaluru", location: "Senior Software Engineer", url: "https://jobs.example.test/A" },
  ], { minimumRows: 1, requiredFields: ["job_id", "title", "location"], identityField: "job_id", expectedHost: "jobs.example.test" });

  expect(report.status).toBe("quarantined");
  expect(report.semanticErrorCount).toBe(2);
  expect(report.errors).toEqual(expect.arrayContaining([
    "semantic field swap: title resembles a location",
    "semantic field swap: location resembles a title",
  ]));
});

test("rejects an exact closing date earlier than an exact posted date", () => {
  const report = assessCollectorRows([
    { job_id: "A", title: "Backend", location: "Pune", posted_date: "2026-08-20", closing_date: "2026-08-19", url: "https://jobs.example.test/A" },
  ], { minimumRows: 1, requiredFields: ["job_id", "title", "location"], identityField: "job_id", expectedHost: "jobs.example.test" });

  expect(report.status).toBe("quarantined");
  expect(report.errors).toContain("closing date precedes posted date");
});

test("reports distributional drift without authorizing automatic healing", () => {
  const baseline = { recordCount: 100, fieldCoverage: { location: 0.98, title: 1 } };
  const current = { recordCount: 70, fieldCoverage: { location: 0.12, title: 1 } };
  const comparison = compareDistributionalHealth(current, baseline);

  expect(comparison.status).toBe("changed");
  expect(comparison.anomalies).toEqual(expect.arrayContaining(["record count dropped by 30%", "field coverage changed materially: location"]));
  expect(comparison.requiresReview).toBe(true);
  expect(comparison.automaticHeal).toBe(false);
});

test("reports material category-distribution drift without authorizing automatic healing", () => {
  const baseline = {
    recordCount: 10,
    fieldCoverage: { location: 1, title: 1 },
    distributions: {
      location: { Pune: 0.5, Bengaluru: 0.5 },
      employment_type: { "Full Time": 1 },
    },
  };
  const current = {
    recordCount: 10,
    fieldCoverage: { location: 1, title: 1 },
    distributions: {
      location: { Pune: 1 },
      employment_type: { "Full Time": 1 },
    },
  };
  const comparison = compareDistributionalHealth(current, baseline);

  expect(comparison.status).toBe("changed");
  expect(comparison.anomalies).toContain("distribution changed materially: location");
  expect(comparison.distributionChanges.location.maxAbsoluteDelta).toBe(0.5);
  expect(comparison.requiresReview).toBe(true);
  expect(comparison.automaticHeal).toBe(false);
});

test("generates a review-gated heal prompt from distributional drift", () => {
  const baseline = { recordCount: 100, fieldCoverage: { location: 0.98, title: 1 } };
  const current = { recordCount: 70, fieldCoverage: { location: 0.12, title: 1 } };
  const diagnosis = buildHealDiagnosis({
    collectorId: "c_visa",
    sourceId: "visa",
    baseline,
    current,
  });

  expect(diagnosis).toMatchObject({ status: "review_required", automaticHeal: false, changedFields: ["location"] });
  expect(diagnosis.prompt).toContain("c_visa");
  expect(diagnosis.prompt).toContain("location coverage changed from 98% to 12%");
  expect(diagnosis.prompt).toContain("preserve the existing output schema");
  expect(diagnosis.prompt).toContain("approval");
});

test("does not produce a healing prompt for a stable comparison", () => {
  const snapshot = { recordCount: 10, fieldCoverage: { title: 1, location: 1 } };
  expect(buildHealDiagnosis({ collectorId: "c_test", sourceId: "zfh", baseline: snapshot, current: snapshot })).toMatchObject({
    status: "no_action",
    automaticHeal: false,
    prompt: null,
  });
});

test("quarantines an explicit transport block even when rows look complete", () => {
  const report = assessCollectorRows([
    { job_id: "A", title: "Backend", location: "Pune", url: "https://jobs.example.test/A" },
  ], {
    minimumRows: 1,
    requiredFields: ["job_id", "title", "location"],
    identityField: "job_id",
    expectedHost: "jobs.example.test",
    transport: { navigationSucceeded: true, httpStatus: 200, finalUrl: "https://jobs.example.test/A", bodyBytes: 12, blocked: true },
  });

  expect(report.status).toBe("quarantined");
  expect(report.transportStatus).toBe("quarantined");
  expect(report.transportErrors).toContain("block or CAPTCHA indicator detected");
});

test("keeps transport confidence unknown when no transport evidence is supplied", () => {
  const report = assessCollectorRows([{ job_id: "A", title: "Backend", location: "Pune" }], { minimumRows: 1 });
  expect(report.transportStatus).toBe("unknown");
  expect(report.transportErrors).toEqual([]);
});

test("quarantines repeated listing URLs even when no identity field is available", () => {
  const report = assessCollectorRows([
    { title: "Backend Engineer", location: "Pune", url: "https://jobs.example.test/A" },
    { title: "Platform Engineer", location: "Bengaluru", url: "https://jobs.example.test/A" },
  ], {
    minimumRows: 2,
    requiredFields: ["title", "location", "url"],
    urlField: "url",
    expectedHost: "jobs.example.test",
  });

  expect(report.status).toBe("quarantined");
  expect(report.duplicateUrlCount).toBe(1);
  expect(report.errors).toContain("duplicate URL values detected");
});

test("quarantines incomplete pagination when page evidence is supplied", () => {
  const report = assessCollectorRows([{ job_id: "A", title: "Backend", location: "Pune" }], {
    minimumRows: 1,
    pagination: { expectedPages: 3, observedPages: 1, terminalPageReached: false },
  });

  expect(report.status).toBe("quarantined");
  expect(report.paginationErrors).toEqual(expect.arrayContaining([
    "pagination stopped before the expected page count",
    "pagination did not reach a terminal page",
  ]));
});

test("allows a verified empty subset but quarantines an unverified empty all-jobs board", () => {
  const subset = assessCollectorRows([], { minimumRows: 0, scopeKind: "subset", emptyStateVerified: true });
  const allJobs = assessCollectorRows([], { minimumRows: 0, scopeKind: "all_jobs" });

  expect(subset.status).toBe("healthy");
  expect(allJobs.status).toBe("quarantined");
  expect(allJobs.errors).toContain("empty all_jobs scope without verified empty state");
});

test("quarantines an inverted numeric salary range", () => {
  const report = assessCollectorRows([{ job_id: "A", title: "Backend", location: "Pune", salary_min: 200000, salary_max: 100000 }], {
    minimumRows: 1,
  });

  expect(report.status).toBe("quarantined");
  expect(report.semanticErrorCount).toBe(1);
  expect(report.errors).toContain("salary minimum exceeds salary maximum");
});
