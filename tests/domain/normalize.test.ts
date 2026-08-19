import { describe, expect, test } from "bun:test";
import { normalizeJobObservation } from "../../src/domain/normalize";

describe("normalizeJobObservation", () => {
  test("preserves a relative posting date as relative evidence", () => {
    const result = normalizeJobObservation({
      source_job_id: "R-42",
      title: "Backend Engineer",
      location: "Bengaluru",
      posted_date: "30+ Days Ago",
      description: "Build APIs",
      url: "https://example.test/jobs/R-42",
    }, { sourceId: "visa", sourceUrl: "https://example.test/jobs", observedAt: "2026-08-20T00:00:00.000Z" });

    expect(result.postedDate).toBe(null);
    expect(result.postedDateQuality).toBe("relative");
    expect(result.provenance.postedDate).toEqual({ raw: "30+ Days Ago", kind: "relative" });
  });

  test("keeps undisclosed salary unknown instead of inferring zero", () => {
    const result = normalizeJobObservation({ title: "Designer", url: "https://example.test/designer" }, {
      sourceId: "zfh", sourceUrl: "https://example.test/jobs", observedAt: "2026-08-20T00:00:00.000Z",
    });

    expect(result.salary).toBe(null);
    expect(result.provenance.salary).toEqual({ kind: "unknown" });
  });
});
