export type DateQuality = "exact" | "relative" | "unavailable";

export type ProvenanceValue =
  | { kind: "unknown" }
  | { raw: string; kind: "exact" | "relative" };

export type JobProvenance = Record<string, ProvenanceValue>;

export interface RawJobRow {
  source_job_id?: string;
  job_id?: string;
  title?: string;
  location?: string;
  employment_type?: string;
  posted_date?: string;
  posted_date_text?: string;
  closing_date?: string;
  closing_date_text?: string;
  description?: string;
  salary?: string;
  application_url?: string;
  job_detail_url?: string;
  product_page_url?: string;
  url?: string;
  [key: string]: unknown;
}

export interface NormalizationContext {
  sourceId: string;
  sourceUrl: string;
  observedAt: string;
}

export interface JobObservation {
  observationId: string;
  sourceId: string;
  sourceUrl: string;
  observedAt: string;
  sourceJobId: string | null;
  title: string | null;
  location: string | null;
  employmentType: string | null;
  postedDate: string | null;
  postedDateQuality: DateQuality;
  closingDate: string | null;
  closingDateQuality: DateQuality;
  description: string | null;
  salary: string | null;
  applicationUrl: string | null;
  url: string | null;
  provenance: JobProvenance;
  sourceConfidence: number;
}
