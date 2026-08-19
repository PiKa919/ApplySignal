import { expect, test } from "bun:test";
import { compareJobIds } from "../../src/domain/validation";

test("reports scraper and oracle agreement without treating missing rows as employer facts", () => {
  const result = compareJobIds({
    sourceId: "postman",
    oracleId: "postman-greenhouse",
    scraperJobIds: ["A", "B", "B"],
    oracleJobIds: ["A", "B", "C"],
    checkedAt: "2026-08-20T00:00:00.000Z",
  });

  expect(result.status).toBe("mismatch");
  expect(result.scraperCount).toBe(2);
  expect(result.oracleCount).toBe(3);
  expect(result.missingFromScraper).toEqual(["C"]);
  expect(result.unexpectedInScraper).toEqual([]);
  expect(result.matchedCount).toBe(2);
  expect(result.agreementRate).toBeCloseTo(2 / 3);
});
