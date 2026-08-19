import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { ingestCollectorResult } from "../../src/collectors/ingest";

test("rejects a successful-looking collector result with silent cardinality loss", () => {
  const db = createDatabase(":memory:");
  expect(() => ingestCollectorResult(db, {
    collectorId: "c_test", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z",
    status: "success", rawOutput: "[]", rows: [], expectedMinimumRows: 1,
  } as any)).toThrow("cardinality");
});
