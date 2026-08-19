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
export type ResumeReentryLabel = "not observed" | "none" | "low" | "medium" | "high";

export type TransparencySignalKey = "location" | "workplace_mode" | "employment_type" | "experience" | "responsibilities" | "requirements" | "skills" | "team_department" | "compensation" | "deadline" | "career_stage" | "process";

export interface TransparencySignal {
  key: TransparencySignalKey;
  label: string;
  points: number;
  observed: boolean;
  evidence: string | null;
}

export interface TransparencyAnalysis {
  score: number;
  signals: TransparencySignal[];
  interpretation: string;
}

export interface ReciprocityAnalysis {
  disclosedCategories: ReciprocityCategory[];
  requestedCategories: ReciprocityCategory[];
  disclosedCount: number;
  requestedFieldCount: number;
  requiredFieldCount: number;
  resumeReentryFieldCount: number;
  resumeReentryLabel: ResumeReentryLabel;
  transparencyScore: number;
  transparencySignals: TransparencySignal[];
  transparencyInterpretation: string;
  gapLabel: ReciprocityGapLabel;
  explanation: string;
}

const unique = (values: ReciprocityCategory[]): ReciprocityCategory[] => [...new Set(values)];
const textOf = (job: JobObservation): string => `${job.title ?? ""} ${job.description ?? ""}`;
const signal = (key: TransparencySignalKey, label: string, points: number, observed: boolean, evidence: string | null): TransparencySignal => ({ key, label, points, observed, evidence });

export function analyzeTransparency(job: JobObservation): TransparencyAnalysis {
  const description = job.description ?? "";
  const allText = textOf(job);
  const signals = [
    signal("location", "Exact location", 8, Boolean(job.location), job.location),
    signal("workplace_mode", "Workplace mode", 6, /\b(?:remote|hybrid|on[- ]?site|work\s+from\s+home)\b/i.test(`${job.location ?? ""} ${description}`), (job.location ?? description.match(/\b(?:remote|hybrid|on[- ]?site|work\s+from\s+home)\b/i)?.[0]) ?? null),
    signal("employment_type", "Employment type", 5, Boolean(job.employmentType), job.employmentType),
    signal("experience", "Experience expectation", 10, /\b(?:\d+\+?\s*(?:-|to)?\s*\d*\s*years?|experience|senior|junior)\b/i.test(allText), description.match(/\b(?:\d+\+?\s*(?:-|to)?\s*\d*\s*years?|experience|senior|junior)\b/i)?.[0] ?? null),
    signal("responsibilities", "Specific responsibilities", 14, /\b(?:responsibilit(?:y|ies)|build|design|develop|own|manage|lead|deliver|work\s+on)\b/i.test(description), description.match(/\b(?:responsibilit(?:y|ies)|build|design|develop|own|manage|lead|deliver|work\s+on)\b/i)?.[0] ?? null),
    signal("requirements", "Specific requirements", 14, /\b(?:requirements?|qualifications?|must|required|you\s+(?:will\s+)?need|you\s+have)\b/i.test(description), description.match(/\b(?:requirements?|qualifications?|must|required|you\s+(?:will\s+)?need|you\s+have)\b/i)?.[0] ?? null),
    signal("skills", "Skills and technologies", 10, /\b(?:skills?|technolog(?:y|ies)|stack|python|javascript|typescript|java|sql|kubernetes|api)\b/i.test(description), description.match(/\b(?:skills?|technolog(?:y|ies)|stack|python|javascript|typescript|java|sql|kubernetes|api)\b/i)?.[0] ?? null),
    signal("team_department", "Team or department", 7, /\b(?:team|department|engineering|platform|backend|frontend|product|data|security|marketing|design|finance|sales)\b/i.test(allText), allText.match(/\b(?:team|department|engineering|platform|backend|frontend|product|data|security|marketing|design|finance|sales)\b/i)?.[0] ?? null),
    signal("compensation", "Compensation", 12, Boolean(job.salary), job.salary),
    signal("deadline", "Closing date", 5, Boolean(job.closingDate), job.closingDate),
    signal("career_stage", "Career stage", 4, /\b(?:intern|internship|graduate|early\s+career|junior|senior|staff|principal|lead)\b/i.test(allText), allText.match(/\b(?:intern|internship|graduate|early\s+career|junior|senior|staff|principal|lead)\b/i)?.[0] ?? null),
    signal("process", "Hiring/process information", 5, /\b(?:interview|process|rounds?|assessment|hiring)\b/i.test(description), description.match(/\b(?:interview|process|rounds?|assessment|hiring)\b/i)?.[0] ?? null),
  ];
  const score = signals.filter((item) => item.observed).reduce((total, item) => total + item.points, 0);
  return {
    score,
    signals,
    interpretation: `Transparency score reflects ${signals.filter((item) => item.observed).length} of ${signals.length} public disclosure signals; it is not a legitimacy or hiring-outcome score.`,
  };
}

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
  const transparency = analyzeTransparency(job);
  const requested = unique(fields.map((field) => field.category));
  const requiredCount = fields.filter((field) => field.required === true).length;
  const resumeRequired = fields.some((field) => field.category === "resume");
  const resumeReentryFieldCount = resumeRequired
    ? fields.filter((field) => ["employment_history", "education", "compensation_history", "experience"].includes(field.category) || (field.category === "identity" && /current\s+employer/i.test(field.label))).length
    : 0;
  const resumeReentryLabel: ResumeReentryLabel = !resumeRequired
    ? "not observed"
    : resumeReentryFieldCount >= 5 ? "high" : resumeReentryFieldCount >= 3 ? "medium" : resumeReentryFieldCount >= 1 ? "low" : "none";
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
    resumeReentryFieldCount,
    resumeReentryLabel,
    transparencyScore: transparency.score,
    transparencySignals: transparency.signals,
    transparencyInterpretation: transparency.interpretation,
    gapLabel,
    explanation,
  };
}
