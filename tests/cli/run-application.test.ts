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

test("does not invoke Bright Data when the application preflight is blocked", async () => {
  const root = await mkdtemp(join(tmpdir(), "applysignal-application-preflight-"));
  const logs: string[] = [];
  let paidCalls = 0;
  await runApplicationCollectorFromEnv({
    APPLYSIGNAL_DB: join(root, "applysignal.db"),
    BRIGHTDATA_APPLICATION_COLLECTOR_ID: "c_application",
    BRIGHTDATA_APPLICATION_SOURCE_ID: "zfh",
    BRIGHTDATA_APPLICATION_TARGET_URL: "https://careers.example.test/jobs/role/apply",
    BRIGHTDATA_APPLICATION_OBSERVATION_ID: "obs-role",
  }, {
    log: (message) => logs.push(message),
    preflight: async () => ({ status: "blocked", sourceId: "zfh", targetUrl: "https://careers.example.test/jobs/role/apply", navigationSucceeded: true, httpStatus: 200, finalUrl: "https://careers.example.test/jobs/role/apply", finalHost: "careers.example.test", contentType: "text/html", bodyBytes: 100, blockIndicators: ["captcha"], brightDataCalls: 0, checkedAt: new Date().toISOString() }),
    runCollector: async () => { paidCalls += 1; throw new Error("paid collector should not run"); },
  });
  expect(paidCalls).toBe(0);
  expect(logs.join("\n")).toContain('"brightDataCalls":0');
  await rm(root, { recursive: true, force: true });
});
