import { expect, test } from "bun:test";
import { assessCollectorRows } from "../../src/collectors/health";

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
