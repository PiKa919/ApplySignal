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
  { sourceId: "palantir", name: "Palantir Lever", url: "https://jobs.lever.co/palantir", status: "live", role: "candidate", note: "307 public listing rows verified through a custom Scraper Studio collector and batch run." },
  { sourceId: "visa", name: "Visa Workday", url: "https://visa.wd5.myworkdayjobs.com/Visa", status: "failed_generation", role: "candidate", note: "Bright Data template generation stalled on the dynamic Workday surface." },
  { sourceId: "cadence", name: "Cadence Workday", url: "https://cadence.wd1.myworkdayjobs.com/en-US/External_Careers", status: "unresolved", role: "candidate", note: "Collector c_mt0il1zsoiz0umxxe reached code generation but did not complete during bounded polling." },
  { sourceId: "browserstack", name: "BrowserStack Workday", url: "https://browserstack.wd3.myworkdayjobs.com/External", status: "unresolved", role: "candidate", note: "Collector c_mt0iq7oysxok3r6q4 reached preview picker but did not complete during bounded polling." },
  { sourceId: "meesho", name: "Meesho Careers", url: "https://www.meesho.io/jobs", status: "failed_generation", role: "candidate", note: "Bright Data returned a terminal template-generation failure." },
  { sourceId: "cred", name: "CRED Careers", url: "https://careers.cred.club/openings", status: "unresolved", role: "candidate", note: "Generation reached preview picker but did not complete in the bounded run." },
  { sourceId: "postman", name: "Postman Careers", url: "https://www.postman.com/company/careers/open-positions/", status: "unresolved", role: "validation_oracle", note: "Collector c_mt0jgbmgtpeo9ghcx reached preview generation but did not complete during bounded polling." },
  { sourceId: "razorpay", name: "Razorpay Careers", url: "https://razorpay.com/careers/", status: "live", role: "candidate", note: "26 public listing rows verified from the linked Greenhouse board through Scraper Studio." },
];
