import type { ReciprocityCategory } from "./reciprocity";

export interface ApplicationFieldSignal {
  label: string;
  category: ReciprocityCategory;
  required: boolean | null;
  inputType?: string;
  isAttachment?: boolean;
  isCustomQuestion?: boolean;
}

export interface ApplicationObservationSummary {
  accountGate: boolean | null;
  resumeRequired: boolean | null;
  requiredFieldCount: number;
  optionalFieldCount: number;
  unknownFieldCount: number;
  customQuestionCount: number;
  longAnswerCount: number;
  attachmentCount: number;
  manualHistoryFields: string[];
}

export interface ApplicationSummaryInput {
  accountRequired: boolean | null;
  fields: ApplicationFieldSignal[];
}

const LONG_ANSWER_LABEL = /\b(?:why|describe|explain|cover\s+letter|additional\s+information)\b/i;
const CUSTOM_QUESTION_LABEL = /\b(?:question|why\s+do\s+you|describe|explain|cover\s+letter)\b/i;
const MANUAL_HISTORY_CATEGORIES = new Set<ReciprocityCategory>(["employment_history", "education", "compensation_history", "experience"]);

function normalizedInputType(field: ApplicationFieldSignal): string {
  return (field.inputType ?? "").trim().toLowerCase().replaceAll("_", "-");
}

export function summarizeApplicationObservation(input: ApplicationSummaryInput): ApplicationObservationSummary {
  const { fields } = input;
  const longAnswerCount = fields.filter((field) => {
    const inputType = normalizedInputType(field);
    return ["textarea", "longtext", "long-answer"].includes(inputType) || LONG_ANSWER_LABEL.test(field.label);
  }).length;
  const manualHistoryFields = [...new Set(fields
    .filter((field) => MANUAL_HISTORY_CATEGORIES.has(field.category) || (field.category === "identity" && /current\s+employer/i.test(field.label)))
    .map((field) => field.label))];

  return {
    accountGate: input.accountRequired,
    resumeRequired: fields.length === 0 ? null : fields.some((field) => field.category === "resume"),
    requiredFieldCount: fields.filter((field) => field.required === true).length,
    optionalFieldCount: fields.filter((field) => field.required === false).length,
    unknownFieldCount: fields.filter((field) => field.required === null).length,
    customQuestionCount: fields.filter((field) => field.isCustomQuestion === true || CUSTOM_QUESTION_LABEL.test(field.label)).length,
    longAnswerCount,
    attachmentCount: fields.filter((field) => field.isAttachment === true || ["file", "attachment"].includes(normalizedInputType(field)) || field.category === "resume").length,
    manualHistoryFields,
  };
}
