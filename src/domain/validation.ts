export type ValidationStatus = "agree" | "mismatch" | "insufficient_data";

export interface JobIdComparisonInput {
  sourceId: string;
  oracleId: string;
  scraperJobIds: string[];
  oracleJobIds: string[];
  checkedAt: string;
}

export interface JobIdComparison {
  sourceId: string;
  oracleId: string;
  checkedAt: string;
  scraperCount: number;
  oracleCount: number;
  matchedCount: number;
  missingFromScraper: string[];
  unexpectedInScraper: string[];
  agreementRate: number | null;
  status: ValidationStatus;
}

const unique = (ids: string[]) => [...new Set(ids.filter((id) => id.trim().length > 0))].sort();

export function compareJobIds(input: JobIdComparisonInput): JobIdComparison {
  const scraper = unique(input.scraperJobIds);
  const oracle = unique(input.oracleJobIds);
  const scraperSet = new Set(scraper);
  const oracleSet = new Set(oracle);
  const missingFromScraper = oracle.filter((id) => !scraperSet.has(id));
  const unexpectedInScraper = scraper.filter((id) => !oracleSet.has(id));
  const matchedCount = scraper.filter((id) => oracleSet.has(id)).length;
  const agreementRate = oracle.length === 0 ? null : matchedCount / oracle.length;

  return {
    sourceId: input.sourceId,
    oracleId: input.oracleId,
    checkedAt: input.checkedAt,
    scraperCount: scraper.length,
    oracleCount: oracle.length,
    matchedCount,
    missingFromScraper,
    unexpectedInScraper,
    agreementRate,
    status: oracle.length === 0 ? "insufficient_data" : missingFromScraper.length === 0 && unexpectedInScraper.length === 0 ? "agree" : "mismatch",
  };
}
