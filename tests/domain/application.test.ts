import { expect, test } from "bun:test";
import { summarizeApplicationObservation } from "../../src/domain/application";

test("summarizes public application burden without candidate values", () => {
  const result = summarizeApplicationObservation({
    accountRequired: true,
    formUrl: "https://example.test/jobs/backend/apply",
    fields: [
      { label: "Resume", category: "resume", required: true, inputType: "file", isAttachment: true },
      { label: "Current CTC", category: "compensation_history", required: true, inputType: "text" },
      { label: "Employment history", category: "employment_history", required: null, inputType: "text" },
      { label: "Why do you want this role?", category: "process", required: false, inputType: "textarea", isCustomQuestion: true },
    ],
  });

  expect(result).toEqual({
    formUrl: "https://example.test/jobs/backend/apply",
    accountGate: true,
    resumeRequired: true,
    requiredFieldCount: 2,
    optionalFieldCount: 1,
    unknownFieldCount: 1,
    customQuestionCount: 1,
    longAnswerCount: 1,
    attachmentCount: 1,
    manualHistoryFields: ["Current CTC", "Employment history"],
  });
});

test("keeps form completeness unknown when no public fields were observed", () => {
  expect(summarizeApplicationObservation({ accountRequired: null, fields: [] })).toMatchObject({
    formUrl: null,
    accountGate: null,
    resumeRequired: null,
    requiredFieldCount: 0,
    optionalFieldCount: 0,
    unknownFieldCount: 0,
  });
});
