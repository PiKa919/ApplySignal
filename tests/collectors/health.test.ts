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
