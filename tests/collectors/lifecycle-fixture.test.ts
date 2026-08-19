import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { inferPostingRelationship } from "../../src/domain/lifecycle";
import { normalizeJobObservation } from "../../src/domain/normalize";

test("lifecycle demo keeps two observations separate and inferable", async () => {
  const rows = JSON.parse(await readFile(new URL("../../src/collectors/fixtures/lifecycle-demo.json", import.meta.url), "utf8"));
  const context = { sourceId: "demo-lifecycle", sourceUrl: "https://example.test/demo-lifecycle", observedAt: "2026-08-20T10:00:00.000Z" };
  const before = normalizeJobObservation(rows[0], { ...context, observedAt: "2026-08-01T10:00:00.000Z" });
  const after = normalizeJobObservation(rows[1], { ...context, observedAt: "2026-08-20T10:00:00.000Z" });

  expect(before.observationId).not.toBe(after.observationId);
  expect(before.sourceJobId).toBe(after.sourceJobId);
  expect(inferPostingRelationship(before, after)?.type).toBe("possible_repost");
});
