import type { JobObservation } from "./observations";

export const RECIPROCITY_CATEGORIES = [
  "role", "location", "experience", "responsibilities", "skills", "compensation", "deadline", "process",
  "identity", "compensation_history", "availability", "relocation", "education", "employment_history", "resume",
] as const;

export type ReciprocityCategory = (typeof RECIPROCITY_CATEGORIES)[number];

export interface ApplicationFieldObservation {
  label: string;
  category: ReciprocityCategory;
  required: boolean | null;
}

export type ReciprocityGapLabel = "balanced" | "demanding but transparent" | "low information" | "information asymmetry";

export interface ReciprocityAnalysis {
  disclosedCategories: ReciprocityCategory[];
  requestedCategories: ReciprocityCategory[];
  disclosedCount: number;
  requestedFieldCount: number;
  requiredFieldCount: number;
  gapLabel: ReciprocityGapLabel;
  explanation: string;
}

const unique = (values: ReciprocityCategory[]): ReciprocityCategory[] => [...new Set(values)];

function disclosedCategories(job: JobObservation): ReciprocityCategory[] {
  const categories: ReciprocityCategory[] = [];
  if (job.title) categories.push("role");
  if (job.location) categories.push("location");
  if (job.description) {
    categories.push("responsibilities");
    if (/\b(?:year|years|experience|senior|junior)\b/i.test(job.description)) categories.push("experience");
    if (/\b(?:skill|technology|stack|typescript|javascript|python|java|api|sql)\b/i.test(job.description)) categories.push("skills");
    if (/\b(?:interview|process|round)\b/i.test(job.description)) categories.push("process");
  }
  if (job.salary) categories.push("compensation");
  if (job.closingDate) categories.push("deadline");
  return unique(categories);
}

export function analyzeReciprocity(job: JobObservation, fields: ApplicationFieldObservation[]): ReciprocityAnalysis {
  const disclosed = disclosedCategories(job);
  const requested = unique(fields.map((field) => field.category));
  const requiredCount = fields.filter((field) => field.required === true).length;
  const missingDisclosure = requested.filter((category) => !disclosed.includes(category));
  const burden = fields.length;
  let gapLabel: ReciprocityGapLabel;

  if (burden === 0 && disclosed.length >= 3) gapLabel = "balanced";
  else if (burden <= 2 && missingDisclosure.length === 0) gapLabel = "demanding but transparent";
  else if (disclosed.length <= 1 && burden === 0) gapLabel = "low information";
  else if (missingDisclosure.length >= 2 && burden >= 2) gapLabel = "information asymmetry";
  else gapLabel = burden > disclosed.length ? "demanding but transparent" : "balanced";

  const missingNames = missingDisclosure.map((category) => category.replaceAll("_", " "));
  const requestedNames = requested.map((category) => category.replaceAll("_", " "));
  const explanation = missingNames.length > 0
    ? `The application requests ${requestedNames.join(", ") || "no categorized fields"}, while the listing does not disclose ${missingNames.join(", ")}.`
    : `The listing discloses ${disclosed.length} categories and the application requests ${burden} fields.`;

  return {
    disclosedCategories: disclosed,
    requestedCategories: requested,
    disclosedCount: disclosed.length,
    requestedFieldCount: burden,
    requiredFieldCount: requiredCount,
    gapLabel,
    explanation,
  };
}
