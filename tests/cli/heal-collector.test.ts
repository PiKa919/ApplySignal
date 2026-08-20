import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { listHealEvents } from "../../src/storage/repository";
import { approveHeal, buildApproveArgs, buildHealArgs, parseHealOutput, runHealPreview } from "../../src/cli/heal-collector";

test("builds a review-gated heal command without auto-approval or auto-save", () => {
  expect(buildHealArgs({ collectorId: "c_test", prompt: "Restore location", targetUrl: "https://example.test/jobs", timeoutSeconds: 30 })).toEqual([
    "scraper", "heal", "c_test", "Restore location", "--url", "https://example.test/jobs", "--timeout", "30", "--json",
  ]);
});

test("builds approval args only when an operator explicitly invokes approval", () => {
  expect(buildApproveArgs({ collectorId: "c_test", targetUrl: "https://example.test/jobs", timeoutSeconds: 45 })).toEqual([
    "scraper", "approve", "c_test", "--url", "https://example.test/jobs", "--timeout", "45", "--json",
  ]);
});

test("parses a heal envelope without treating preview completion as approval", () => {
  expect(parseHealOutput(JSON.stringify({ collector_id: "c_test", status: "awaiting_approval", next_step: "approve" }))).toEqual({
    collectorId: "c_test",
    status: "awaiting_approval",
    nextStep: "approve",
    raw: { collector_id: "c_test", status: "awaiting_approval", next_step: "approve" },
  });
});

test("persists a heal preview as awaiting approval without adding automatic flags", async () => {
  const db = createDatabase(":memory:");
  const result = await runHealPreview({
    db,
    sourceId: "visa",
    collectorId: "c_test",
    failedRunId: "run-bad",
    reason: "location drift",
    prompt: "Restore location",
    targetUrl: "https://example.test/jobs",
  }, async (args) => {
    expect(args).toEqual(["scraper", "heal", "c_test", "Restore location", "--url", "https://example.test/jobs", "--json"]);
    return { exitCode: 0, stdout: JSON.stringify({ collector_id: "c_test", status: "awaiting_approval" }), stderr: "" };
  });
  expect(result.status).toBe("awaiting_approval");
  expect(listHealEvents(db)[0]).toMatchObject({ sourceId: "visa", approved: null, previewResult: { status: "awaiting_approval" } });
});

test("requires an explicit approval call before marking the latest heal event approved", async () => {
  const db = createDatabase(":memory:");
  await runHealPreview({ db, sourceId: "visa", collectorId: "c_test", failedRunId: "run-bad", reason: "location drift", prompt: "Restore location" }, async () => ({ exitCode: 0, stdout: JSON.stringify({ collector_id: "c_test", status: "awaiting_approval" }), stderr: "" }));
  await approveHeal({ db, sourceId: "visa", collectorId: "c_test", failedRunId: "run-bad" }, async (args) => {
    expect(args).toEqual(["scraper", "approve", "c_test", "--json"]);
    return { exitCode: 0, stdout: JSON.stringify({ collector_id: "c_test", status: "approved" }), stderr: "" };
  });
  expect(listHealEvents(db)[0]).toMatchObject({ approved: true });
});

test("does not mark a heal approved when Bright Data returns another pending status", async () => {
  const db = createDatabase(":memory:");
  await runHealPreview({ db, sourceId: "visa", collectorId: "c_test", failedRunId: "run-pending", reason: "location drift", prompt: "Restore location" }, async () => ({ exitCode: 0, stdout: JSON.stringify({ collector_id: "c_test", status: "awaiting_approval" }), stderr: "" }));
  await expect(approveHeal({ db, sourceId: "visa", collectorId: "c_test", failedRunId: "run-pending" }, async () => ({ exitCode: 0, stdout: JSON.stringify({ collector_id: "c_test", status: "awaiting_approval" }), stderr: "" }))).rejects.toThrow("did not complete");
  expect(listHealEvents(db)[0]).toMatchObject({ approved: null });
});
