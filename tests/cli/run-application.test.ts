import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applicationRequestFromEnv, runApplicationCollectorFromEnv } from "../../src/cli/run-application";
import { createDatabase } from "../../src/storage/database";
import { saveScrapeRun } from "../../src/storage/repository";

test("builds a bounded public application collector request", () => {
  expect(applicationRequestFromEnv({
    BRIGHTDATA_APPLICATION_COLLECTOR_ID: "c_application",
    BRIGHTDATA_APPLICATION_SOURCE_ID: "zfh",
    BRIGHTDATA_APPLICATION_TARGET_URL: "https://careers.example.test/jobs/role/apply",
    BRIGHTDATA_APPLICATION_OBSERVATION_ID: "obs-role",
  })).toEqual({
    collectorId: "c_application",
    sourceId: "zfh",
    sourceUrl: "https://careers.example.test/jobs/role/apply",
    url: "https://careers.example.test/jobs/role/apply",
    observationId: "obs-role",
    expectedMinimumRows: 1,
    runKind: "application",
  });
});

test("rejects an application collector without a target observation", () => {
  expect(() => applicationRequestFromEnv({
    BRIGHTDATA_APPLICATION_COLLECTOR_ID: "c_application",
    BRIGHTDATA_APPLICATION_SOURCE_ID: "zfh",
    BRIGHTDATA_APPLICATION_TARGET_URL: "https://careers.example.test/jobs/role/apply",
  })).toThrow("BRIGHTDATA_APPLICATION_OBSERVATION_ID");
});

test("skips a recent application run before invoking Bright Data", async () => {
  const root = await mkdtemp(join(tmpdir(), "applysignal-application-cli-"));
  const dbPath = join(root, "applysignal.db");
  const db = createDatabase(dbPath);
  saveScrapeRun(db, {
    runId: "recent-application",
    collectorId: "c_application",
    sourceId: "zfh",
    runKind: "application",
    observedAt: new Date().toISOString(),
    status: "success",
    rowCount: 17,
    expectedMinimumRows: 1,
    rawOutput: "[redacted]",
  });
  db.close();
  await runApplicationCollectorFromEnv({
    APPLYSIGNAL_DB: dbPath,
    BRIGHTDATA_APPLICATION_COLLECTOR_ID: "c_application",
    BRIGHTDATA_APPLICATION_SOURCE_ID: "zfh",
    BRIGHTDATA_APPLICATION_TARGET_URL: "https://careers.example.test/jobs/role/apply",
    BRIGHTDATA_APPLICATION_OBSERVATION_ID: "obs-role",
  });
  await rm(root, { recursive: true, force: true });
});
