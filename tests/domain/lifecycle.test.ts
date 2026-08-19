import { expect, test } from "bun:test";
import { diffObservations, inferPostingRelationship } from "../../src/domain/lifecycle";

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
