import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { ingestApplicationFields } from "../../src/collectors/ingest";
import { listApplicationFields, listApplicationObservation, saveObservation } from "../../src/storage/repository";

test("ingests visible application fields without collecting candidate values", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-backend", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", title: "Backend" } as any);
  const result = ingestApplicationFields(db, "obs-backend", {
    application_form_fields: [
      { field_label: "Current ctc", normalized_category: "compensation_history", is_required: true, input_type: "text" },
      { field_label: "Notice Period", normalized_category: "availability", is_required: true, input_type: "text" },
    ],
  }, "https://example.test/jobs/backend/apply");
  expect(result).toBe(2);
  expect(listApplicationFields(db, "obs-backend")).toEqual([
    { label: "Current ctc", category: "compensation_history", required: true },
    { label: "Notice Period", category: "availability", required: true },
  ]);
});

test("summarizes account gate and application burden from public field metadata", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-application", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", title: "Backend" } as any);
  ingestApplicationFields(db, "obs-application", {
    account_required: true,
    application_form_fields: [
      { field_label: "Resume", normalized_category: "resume", is_required: true, input_type: "file", is_attachment: true },
      { field_label: "Current CTC", normalized_category: "compensation_history", is_required: true, input_type: "text" },
      { field_label: "Why do you want this role?", normalized_category: "process", is_required: false, input_type: "textarea", is_custom_question: true },
    ],
  }, "https://example.test/jobs/backend/apply");
  expect(listApplicationObservation(db, "obs-application")).toEqual({
    formUrl: "https://example.test/jobs/backend/apply",
    accountGate: true,
    resumeRequired: true,
    requiredFieldCount: 2,
    optionalFieldCount: 1,
    unknownFieldCount: 0,
    customQuestionCount: 1,
    longAnswerCount: 1,
    attachmentCount: 1,
    manualHistoryFields: ["Current CTC"],
  });
});
