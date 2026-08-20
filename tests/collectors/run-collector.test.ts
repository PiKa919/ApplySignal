import { expect, test } from "bun:test";
import { collectorRequestFromEnv, runCollectorFromEnv } from "../../src/cli/run-collector";
import { shouldSkipPaidRun } from "../../src/collectors/policy";

test("builds a collector request from non-secret environment configuration", () => {
  expect(collectorRequestFromEnv({
    BRIGHTDATA_COLLECTOR_ID: "c_test",
    BRIGHTDATA_SOURCE_ID: "zfh",
    BRIGHTDATA_SOURCE_URL: "https://example.test/jobs",
    BRIGHTDATA_TARGET_URL: "https://example.test/jobs",
    BRIGHTDATA_MIN_ROWS: "3",
    BRIGHTDATA_REQUIRED_FIELDS: "source_job_id, title, location",
    BRIGHTDATA_IDENTITY_FIELD: "source_job_id",
    BRIGHTDATA_EXPECTED_HOST: "example.test",
    BRIGHTDATA_MIN_COVERAGE: "0.8",
  })).toEqual({ collectorId: "c_test", sourceId: "zfh", sourceUrl: "https://example.test/jobs", url: "https://example.test/jobs", expectedMinimumRows: 3, requiredFields: ["source_job_id", "title", "location"], identityField: "source_job_id", expectedHost: "example.test", minimumCoverage: 0.8, scopeKind: "all_jobs" });
});

test("rejects a collector command without an ID", () => {
  expect(() => collectorRequestFromEnv({ BRIGHTDATA_SOURCE_ID: "zfh" })).toThrow("BRIGHTDATA_COLLECTOR_ID");
});

test("skips a recent successful run unless an explicit force flag is set", () => {
  const request = { collectorId: "c_test", sourceId: "zfh" };
  const runs = [{ collectorId: "c_test", sourceId: "zfh", status: "success", observedAt: "2026-08-20T11:00:00.000Z" }] as any;
  const now = new Date("2026-08-20T12:00:00.000Z");

  expect(shouldSkipPaidRun(runs, request, now)).toEqual({ skip: true, reason: "recent_success" });
  expect(shouldSkipPaidRun(runs, request, now, { force: true })).toEqual({ skip: false });
});

test("skips a recent failed or quarantined run unless an explicit force flag is set", () => {
  const request = { collectorId: "c_test", sourceId: "cred" };
  const runs = [{ collectorId: "c_test", sourceId: "cred", status: "cardinality_failed", healthStatus: "quarantined", observedAt: "2026-08-20T11:30:00.000Z" }] as any;
  const now = new Date("2026-08-20T12:00:00.000Z");

  expect(shouldSkipPaidRun(runs, request, now)).toEqual({ skip: true, reason: "recent_failure" });
  expect(shouldSkipPaidRun(runs, request, now, { force: true })).toEqual({ skip: false });
});

test("rejects an invalid field-coverage threshold", () => {
  expect(() => collectorRequestFromEnv({ BRIGHTDATA_COLLECTOR_ID: "c_test", BRIGHTDATA_SOURCE_ID: "zfh", BRIGHTDATA_MIN_COVERAGE: "1.2" })).toThrow("BRIGHTDATA_MIN_COVERAGE");
});

test("builds scope-aware health configuration from environment", () => {
  expect(collectorRequestFromEnv({
    BRIGHTDATA_COLLECTOR_ID: "c_test",
    BRIGHTDATA_SOURCE_ID: "razorpay-tech",
    BRIGHTDATA_SCOPE_KIND: "subset",
    BRIGHTDATA_EMPTY_STATE_VERIFIED: "true",
    BRIGHTDATA_URL_FIELD: "url",
  })).toMatchObject({
    scopeKind: "subset",
    emptyStateVerified: true,
    urlField: "url",
  });
});

test("does not invoke Bright Data when the automatic preflight is blocked", async () => {
  let paidCalls = 0;
  const logs: string[] = [];

  await runCollectorFromEnv({
    BRIGHTDATA_COLLECTOR_ID: "c_test",
    BRIGHTDATA_SOURCE_ID: "blocked-source",
    BRIGHTDATA_TARGET_URL: "https://example.test/jobs",
    APPLYSIGNAL_DB: ":memory:",
  }, {
    preflight: async () => ({ status: "blocked", brightDataCalls: 0 }),
    runCollector: async () => {
      paidCalls += 1;
      throw new Error("paid collector should not run");
    },
    log: (message) => logs.push(message),
  });

  expect(paidCalls).toBe(0);
  expect(JSON.parse(logs[0])).toMatchObject({
    skipped: true,
    reason: "preflight_blocked",
    brightDataCalls: 0,
  });
});

test("requires an explicit disabled mode before bypassing preflight", async () => {
  let paidCalls = 0;
  const logs: string[] = [];

  await runCollectorFromEnv({
    BRIGHTDATA_COLLECTOR_ID: "c_test",
    BRIGHTDATA_SOURCE_ID: "dynamic-source",
    BRIGHTDATA_TARGET_URL: "https://example.test/jobs",
    APPLYSIGNAL_DB: ":memory:",
    APPLYSIGNAL_PREFLIGHT_MODE: "disabled",
  }, {
    preflight: async () => {
      throw new Error("preflight should be bypassed only in explicit disabled mode");
    },
    runCollector: async () => {
      paidCalls += 1;
      return {
        runId: "run-1",
        collectorId: "c_test",
        sourceId: "dynamic-source",
        observedAt: "2026-08-20T00:00:00.000Z",
        status: "success",
        rawOutput: "[]",
        rows: [{ title: "Role", url: "https://example.test/jobs/1" }],
        expectedMinimumRows: 1,
      } as any;
    },
    log: (message) => logs.push(message),
  });

  expect(paidCalls).toBe(1);
  expect(JSON.parse(logs[0])).toMatchObject({ preflight: { status: "disabled" } });
});
