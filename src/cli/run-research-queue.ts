import { createDatabase } from "../storage/database";
import { resolveDatabasePath } from "../runtime/database-path";
import { processResearchQueue } from "../queue/research";

const collectorId = process.env.BRIGHTDATA_RESEARCH_COLLECTOR_ID;
if (!collectorId) throw new Error("BRIGHTDATA_RESEARCH_COLLECTOR_ID is required");

const configuredPath = process.env.APPLYSIGNAL_DB ?? "data/applysignal.db";
const db = createDatabase(resolveDatabasePath(configuredPath, { liveOnly: false }));
try {
  const result = await processResearchQueue(db, {
    collectorId,
    maxItems: Number(process.env.APPLYSIGNAL_RESEARCH_MAX_ITEMS ?? "1"),
    retryDelayMinutes: Number(process.env.APPLYSIGNAL_RESEARCH_RETRY_MINUTES ?? "15"),
  });
  console.log(JSON.stringify(result));
} finally {
  db.close();
}
