export type SourceCatalogStatus = "live" | "failed_generation" | "partial" | "unresolved" | "preflight_pending";

export interface SourceCatalogEntry {
  sourceId: string;
  name: string;
  url: string;
  status: SourceCatalogStatus;
  role: "hero" | "candidate" | "validation_oracle";
  note: string;
}

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  { sourceId: "zfh", name: "Zerodha Fund House", url: "https://careers.zerodhafundhouse.com/jobs", status: "live", role: "hero", note: "13 listing rows and 17 public application fields verified." },
  { sourceId: "visa", name: "Visa Workday", url: "https://visa.wd5.myworkdayjobs.com/Visa", status: "failed_generation", role: "candidate", note: "Bright Data template generation stalled on the dynamic Workday surface." },
  { sourceId: "cadence", name: "Cadence Workday", url: "https://cadence.wd1.myworkdayjobs.com/en-US/External_Careers", status: "preflight_pending", role: "candidate", note: "Candidate-specific Marketplace/library lookup still required." },
  { sourceId: "browserstack", name: "BrowserStack Workday", url: "https://browserstack.wd3.myworkdayjobs.com/External", status: "preflight_pending", role: "candidate", note: "Candidate-specific Marketplace/library lookup still required." },
  { sourceId: "meesho", name: "Meesho Careers", url: "https://www.meesho.io/jobs", status: "failed_generation", role: "candidate", note: "Bright Data returned a terminal template-generation failure." },
  { sourceId: "cred", name: "CRED Careers", url: "https://careers.cred.club/openings", status: "unresolved", role: "candidate", note: "Generation reached preview picker but did not complete in the bounded run." },
  { sourceId: "postman", name: "Postman Careers", url: "https://www.postman.com/company/careers/open-positions/", status: "unresolved", role: "validation_oracle", note: "Branded-source generation did not complete in the bounded run." },
  { sourceId: "razorpay", name: "Razorpay Careers", url: "https://razorpay.com/careers/", status: "partial", role: "candidate", note: "Branded page routed to the public Greenhouse board; listing extraction remains unresolved." },
];
