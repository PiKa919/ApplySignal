import { expect, test } from "bun:test";
import { collectorRequestFromEnv } from "../../src/cli/run-collector";

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
