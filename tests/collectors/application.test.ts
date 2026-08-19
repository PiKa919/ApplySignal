import { expect, test } from "bun:test";
import { createDatabase } from "../../src/storage/database";
import { ingestApplicationFields } from "../../src/collectors/ingest";
import { listApplicationFields, saveObservation } from "../../src/storage/repository";

test("ingests visible application fields without collecting candidate values", () => {
  const db = createDatabase(":memory:");
  saveObservation(db, { observationId: "obs-backend", sourceId: "zfh", observedAt: "2026-08-20T00:00:00.000Z", title: "Backend" } as any);
  const result = ingestApplicationFields(db, "obs-backend", {
    application_form_fields: [
      { field_label: "Current ctc", normalized_category: "compensation_history", is_required: true, input_type: "text" },
      { field_label: "Notice Period", normalized_category: "availability", is_required: true, input_type: "text" },
    ],
  });
  expect(result).toBe(2);
  expect(listApplicationFields(db, "obs-backend")).toEqual([
    { label: "Current ctc", category: "compensation_history", required: true },
    { label: "Notice Period", category: "availability", required: true },
  ]);
});
