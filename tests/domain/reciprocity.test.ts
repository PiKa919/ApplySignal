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

test("calculates a resume re-entry tax from public application fields", () => {
  const result = analyzeReciprocity({ title: "Engineer", location: "Bengaluru", description: "Build systems" } as any, [
    { label: "Resume", category: "resume", required: true },
    { label: "Current employer", category: "identity", required: true },
    { label: "Employment history", category: "employment_history", required: true },
    { label: "Education history", category: "education", required: true },
    { label: "Current CTC", category: "compensation_history", required: true },
    { label: "Years of experience", category: "experience", required: true },
  ]);

  expect(result.resumeReentryFieldCount).toBe(5);
  expect(result.resumeReentryLabel).toBe("high");
});
