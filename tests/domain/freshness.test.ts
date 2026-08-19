import { expect, test } from "bun:test";
import { analyzeFreshness } from "../../src/domain/freshness";
import { normalizeJobObservation } from "../../src/domain/normalize";

const context = { sourceId: "visa", sourceUrl: "https://example.test/jobs", observedAt: "2026-08-20T00:00:00.000Z" };

test("keeps an exact source date and computes its observed age", () => {
  const job = normalizeJobObservation({ title: "Backend Engineer", posted_date: "2026-08-18", url: "https://example.test/job/1" }, context);
  expect(analyzeFreshness(job)).toMatchObject({ precision: "exact", sourcePublishedAt: "2026-08-18", ageDays: 2, firstSeenAt: context.observedAt });
});

test("represents a relative source date as a lower bound", () => {
  const job = normalizeJobObservation({ title: "Backend Engineer", posted_date: "30+ Days Ago", url: "https://example.test/job/2" }, context);
  expect(analyzeFreshness(job)).toMatchObject({ precision: "lower_bound", sourcePublishedAt: null, ageMinDays: 30, sourcePublishedText: "30+ Days Ago" });
});

test("does not infer freshness when the source gives no date", () => {
  const job = normalizeJobObservation({ title: "Backend Engineer", url: "https://example.test/job/3" }, context);
  expect(analyzeFreshness(job)).toMatchObject({ precision: "unknown", sourcePublishedAt: null, ageDays: null, ageMinDays: null, firstSeenAt: context.observedAt });
});
