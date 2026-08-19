import { expect, test } from "bun:test";
import { analyzeReciprocity } from "../../src/domain/reciprocity";

test("labels high application burden with low disclosure as information asymmetry", () => {
  const result = analyzeReciprocity({
    title: "Backend Engineer",
    location: "Bengaluru",
    description: "Responsibilities and 5-7 years experience",
    salary: null,
  } as any, [
    { label: "Current CTC", category: "compensation_history", required: true },
    { label: "Expected CTC", category: "compensation_history", required: true },
    { label: "Notice period", category: "availability", required: true },
  ]);

  expect(result.gapLabel).toBe("information asymmetry");
  expect(result.explanation).toContain("compensation");
});
