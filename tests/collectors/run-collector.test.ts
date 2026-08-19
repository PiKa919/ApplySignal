import { expect, test } from "bun:test";
import { collectorRequestFromEnv } from "../../src/cli/run-collector";
import { shouldSkipPaidRun } from "../../src/collectors/policy";

test("builds a collector request from non-secret environment configuration", () => {
  expect(collectorRequestFromEnv({
    BRIGHTDATA_COLLECTOR_ID: "c_test",
    BRIGHTDATA_SOURCE_ID: "zfh",
    BRIGHTDATA_SOURCE_URL: "https://example.test/jobs",
    BRIGHTDATA_TARGET_URL: "https://example.test/jobs",
    BRIGHTDATA_MIN_ROWS: "3",
  })).toEqual({ collectorId: "c_test", sourceId: "zfh", sourceUrl: "https://example.test/jobs", url: "https://example.test/jobs", expectedMinimumRows: 3 });
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
