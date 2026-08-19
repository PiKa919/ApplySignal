import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { listValidationResults, saveValidationResult } from "../../src/storage/repository";

test("persists validation results separately from scrape runs", () => {
  const db = createDatabase(":memory:");
  saveValidationResult(db, {
    sourceId: "postman",
    oracleId: "postman-greenhouse",
    checkedAt: "2026-08-20T00:00:00.000Z",
    scraperCount: 2,
    oracleCount: 3,
    matchedCount: 2,
    missingFromScraper: ["C"],
    unexpectedInScraper: [],
    agreementRate: 2 / 3,
    status: "mismatch",
  });

  expect(listValidationResults(db)).toEqual([expect.objectContaining({ sourceId: "postman", status: "mismatch", missingFromScraper: ["C"] })]);
});
