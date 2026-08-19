import { expect, test } from "bun:test";
import { classifyLifecycleState, diffObservations, inferPostingRelationship } from "../../src/domain/lifecycle";

test("reports a changed closing date as a field fact", () => {
  const before = { observationId: "a", title: "Backend", closingDate: null } as any;
  const after = { observationId: "b", title: "Backend", closingDate: "2026-09-01" } as any;
  expect(diffObservations(before, after).changes).toEqual([{ field: "closingDate", before: null, after: "2026-09-01" }]);
});

test("returns a possible repost inference without merging observations", () => {
  const a = { observationId: "a", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs" } as any;
  const b = { observationId: "b", title: "Backend Engineer", location: "Bengaluru", description: "Build APIs" } as any;
  const result = inferPostingRelationship(a, b);
  expect(result?.type).toBe("possible_repost");
  expect(result?.observationIds).toEqual(["a", "b"]);
});

const observation = (overrides: Record<string, unknown> = {}) => ({
  observationId: "current",
  sourceId: "fixture",
  sourceJobId: "REQ-1",
  title: "Backend Engineer",
  location: "Bengaluru",
  description: "Build APIs",
  flags: { explicitEvergreen: false, evergreenLike: false, talentPool: false, multipleOpenings: false },
  ...overrides,
}) as any;

test("classifies an unseen posting as newly observed", () => {
  expect(classifyLifecycleState({ current: observation(), previous: null })).toBe("NEWLY_OBSERVED");
});

test("distinguishes stable and meaningfully updated observations", () => {
  const previous = observation({ observationId: "previous" });
  expect(classifyLifecycleState({ current: observation(), previous })).toBe("ACTIVE_STABLE");
  expect(classifyLifecycleState({ current: observation({ closingDate: "2026-09-01" }), previous })).toBe("MEANINGFULLY_UPDATED");
});

test("preserves explicit evergreen and talent-pool states", () => {
  expect(classifyLifecycleState({ current: observation({ flags: { explicitEvergreen: true, evergreenLike: true, talentPool: false, multipleOpenings: false } }), previous: null })).toBe("EXPLICIT_EVERGREEN");
  expect(classifyLifecycleState({ current: observation({ flags: { explicitEvergreen: false, evergreenLike: true, talentPool: true, multipleOpenings: false } }), previous: null })).toBe("TALENT_POOL");
});

test("classifies removal, reappearance, and closed applications", () => {
  const previous = observation({ observationId: "previous" });
  expect(classifyLifecycleState({ current: null, previous, currentWasPresent: false })).toBe("REMOVED");
  expect(classifyLifecycleState({ current: observation(), previous, previousWasPresent: false })).toBe("REAPPEARED");
  expect(classifyLifecycleState({ current: observation(), previous, applicationOpen: false })).toBe("APPLICATION_CLOSED");
  expect(classifyLifecycleState({ current: null, previous: null })).toBe("UNKNOWN");
});
