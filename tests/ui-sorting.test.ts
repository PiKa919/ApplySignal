import { expect, test } from "bun:test";
import { postedDateLabel, sortJobsByPostedDate, type PostedJob } from "../src/ui/sorting";

const job = (overrides: Partial<PostedJob>): PostedJob => ({
  observationId: "base",
  observedAt: "2026-08-20T00:00:00.000Z",
  postedDate: null,
  postedDateQuality: "unavailable",
  ...overrides,
});

test("sorts exact posted dates newest first and undated jobs by observation time", () => {
  const sorted = sortJobsByPostedDate([
    job({ observationId: "undated-old", observedAt: "2026-08-18T00:00:00.000Z" }),
    job({ observationId: "exact-old", postedDate: "2026-08-19", postedDateQuality: "exact" }),
    job({ observationId: "undated-new", observedAt: "2026-08-21T00:00:00.000Z", postedDateQuality: "relative" }),
    job({ observationId: "exact-new", postedDate: "2026-08-20", postedDateQuality: "exact" }),
  ]);

  expect(sorted.map(({ observationId }) => observationId)).toEqual(["exact-new", "exact-old", "undated-new", "undated-old"]);
});

test("labels exact dates and does not invent dates for undated jobs", () => {
  expect(postedDateLabel(job({ postedDate: "2026-08-20", postedDateQuality: "exact" }))).toBe("Posted · 2026-08-20");
  expect(postedDateLabel(job({ postedDate: null, postedDateQuality: "relative" }))).toBe("Posted date unavailable");
});
