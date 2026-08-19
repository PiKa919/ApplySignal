import { expect, test } from "bun:test";
import { analyzeReciprocity, analyzeTransparency } from "../../src/domain/reciprocity";

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

test("calculates an explainable transparency score from independent disclosure signals", () => {
  const result = analyzeTransparency({
    title: "Senior Backend Engineer",
    location: "Remote",
    employmentType: "Full Time",
    description: "Join the platform engineering team. Responsibilities include building APIs. Requirements: 5 years experience and strong Python skills. Interview process has three rounds.",
    salary: "$100,000-$140,000",
    closingDate: "2026-09-10",
  } as any);

  expect(result.score).toBe(100);
  expect(result.signals).toHaveLength(12);
  expect(result.signals.every((signal) => signal.observed)).toBe(true);
  expect(result.signals.map((signal) => signal.points).reduce((sum, points) => sum + points, 0)).toBe(100);
});

test("does not turn missing transparency into an employer-legitimacy claim", () => {
  const result = analyzeTransparency({ title: "Engineer" } as any);

  expect(result.score).toBe(0);
  expect(result.signals.filter((signal) => !signal.observed)).toHaveLength(12);
  expect(result.interpretation).toContain("disclosure");
});

test("carries the transparency interpretation through the Reciprocity analysis", () => {
  const result = analyzeReciprocity({ title: "Engineer", location: "Remote" } as any, []);

  expect(result.transparencyInterpretation).toContain("not a legitimacy");
});
