import { expect, test } from "bun:test";
import { loadControlledFixture } from "../../src/collectors/controlled-fixture";
import { buildHealthDemoEvidence } from "../../src/cli/demo";

test("health demo quarantines a broken fixture run and retains the last known good output", async () => {
  const fixture = await loadControlledFixture("layout-a");
  const brokenRows = fixture.rows.slice(0, 4).map((row, index) => index === 0 ? { ...row, location: undefined } : row);

  const evidence = buildHealthDemoEvidence({
    baselineRows: fixture.rows,
    currentRows: brokenRows,
    collectorId: "fixture-controlled-career-site",
    sourceId: "demo-controlled",
    contract: {
      minimumRows: 6,
      requiredFields: ["source_job_id", "title", "location", "url"],
      identityField: "source_job_id",
      expectedHost: "fixture.applysignal.test",
    },
  });

  expect(evidence.baseline.health.status).toBe("healthy");
  expect(evidence.current.health.status).toBe("quarantined");
  expect(evidence.current.health.recordCount).toBe(4);
  expect(evidence.current.health.errors).toEqual(expect.arrayContaining([
    "record count below minimum: 4",
    "field coverage below threshold: location",
  ]));
  expect(evidence.comparison.status).toBe("changed");
  expect(evidence.diagnosis.status).toBe("review_required");
  expect(evidence.diagnosis.changedFields).toContain("location");
  expect(evidence.lastKnownGoodRetained).toBe(true);
  expect(evidence.brokenRunCommitted).toBe(false);
  expect(evidence.approvalRequired).toBe(true);
  expect(evidence.brightDataCalls).toBe(0);
});
