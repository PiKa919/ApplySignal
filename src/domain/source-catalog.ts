export type SourceCatalogStatus = "live" | "live_scoped" | "failed_generation" | "partial" | "unresolved" | "preflight_pending";

export interface SourceScope {
  geography: null | "india";
  department: null | "technology";
  careerStage: null | "early-career";
  employmentType: string | null;
  boardKind: "all_jobs" | "subset" | "talent_pool";
}

export interface SourceCatalogEntry {
  sourceId: string;
  name: string;
  url: string;
  status: SourceCatalogStatus;
  role: "hero" | "candidate" | "validation_oracle";
  scope: SourceScope;
  note: string;
}

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  { sourceId: "zfh", name: "Zerodha Fund House", url: "https://careers.zerodhafundhouse.com/jobs", status: "live", role: "hero", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "13 listing rows and 17 public application fields verified." },
  { sourceId: "palantir", name: "Palantir Lever", url: "https://jobs.lever.co/palantir", status: "live", role: "candidate", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "307 public listing rows verified through a custom Scraper Studio collector and batch run." },
  { sourceId: "visa", name: "Visa Workday", url: "https://visa.wd5.myworkdayjobs.com/Visa", status: "live_scoped", role: "candidate", scope: { geography: "india", department: null, careerStage: null, employmentType: null, boardKind: "subset" }, note: "One public Workday detail page is live and normalized; full-board generation remains unresolved." },
  { sourceId: "cadence", name: "Cadence Workday", url: "https://cadence.wd1.myworkdayjobs.com/en-US/External_Careers", status: "live_scoped", role: "candidate", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "subset" }, note: "One public detail page is live and normalized; Bright Data returned duplicated location/time/date text and full-board generation remains unresolved." },
  { sourceId: "browserstack", name: "BrowserStack Workday", url: "https://browserstack.wd3.myworkdayjobs.com/External", status: "unresolved", role: "candidate", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "Board collector c_mt0iq7oysxok3r6q4, scoped detail collector c_mt0k5nx71ktmkmh3ul, and bounded CLI attempt c_mt18102x1tmz2acjx0 did not produce a completed preview or output." },
  { sourceId: "meesho", name: "Meesho Careers", url: "https://www.meesho.io/jobs", status: "failed_generation", role: "candidate", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "Bright Data collectors c_mt0hdp0f1cpuyp09vq and c_mt0jywoc3netn7272 both failed during generation." },
  { sourceId: "cred", name: "CRED Careers", url: "https://careers.cred.club/openings", status: "unresolved", role: "candidate", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "Direct Lever collector c_mt0jsv3s22rjyq5w83 returned zero rows on one bounded public detail probe; scoped CLI generation c_mt189layinrjas5h2 also timed out before preview, so CRED remains unresolved." },
  { sourceId: "postman", name: "Postman Careers", url: "https://www.postman.com/company/careers/open-positions/", status: "partial", role: "validation_oracle", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "Existing collector returned a nested envelope; 50 unique job IDs normalized versus 111 public Greenhouse oracle IDs. Board retry j_mt0l8qht2gqsa4doyh handed off to batch without returned output." },
  { sourceId: "razorpay", name: "Razorpay Careers", url: "https://razorpay.com/careers/", status: "live", role: "candidate", scope: { geography: null, department: null, careerStage: null, employmentType: null, boardKind: "all_jobs" }, note: "26 public listing rows verified from the linked Greenhouse board through Scraper Studio." },
];
